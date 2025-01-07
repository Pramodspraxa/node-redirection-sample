import staticRedirections from './staticRedirections.json' assert { type: 'json' };
import dynamicRedirections, { util } from './dynamicRedirections.js';
import fs from 'fs';
import pathToRegexp from './path-to-regexp.js'

const permanentRedirectionList = staticRedirections.concat(dynamicRedirections).map(entry => {
    if (Array.isArray(entry)) {
        return { from: entry[0], to: entry[1] };
    }
    return entry;
});
const logger = console;

// Create a matcher for the router
permanentRedirectionList.forEach(rule => {
    rule.keys = [];
    rule.regexp = pathToRegexp(rule.from, rule.keys, { end: true });
});

const retrievePermanentUrl = (source) => {
    const ruleList = permanentRedirectionList;
    for (const rule of ruleList) {
        //Try matching the URL pattern with source
        const match = rule.regexp.exec(source);
        if (match) {
            const params = rule.keys.reduce((acc, key, index) => {
                acc[key.name] = match[index + 1];
                return acc;
            }, {});
            let fn = rule.to;
            if (typeof fn === 'string') {
                if (fn.startsWith("$")) {
                    fn = util[rule.to.substring(1)];
                } else if (fn.includes("{")) {
                    fn = util.replacement;
                }
            }
            let resultUrl = typeof fn === 'function' ? fn({ params, rule }) : rule.to;
            return { ...rule, resultUrl };
        }
    }
};
const reroute = (req, res, next) => {
	const result = retrievePermanentUrl(req.url);
	if (result?.resultUrl) {
		let resultUrl = result.resultUrl;
		if (typeof resultUrl === 'number') {
			res.status(resultUrl);
			return next.render(req, res, '/wrapper404');
		}
		return res.redirect(resultUrl, util.StatusCode.PermanentRedirect);
	}
	next();
}
const executeTests = async () => {
    const testCaseData = fs.readFileSync('./test-cases.csv', 'utf8');
    let testCases = [];
    // push static test cases
    staticRedirections.forEach(({ from, to, tests }) => {
        if (tests) {
            tests.forEach((testCase) => {
                if (typeof testCase === 'string') {
                    testCases.push([testCase, to]);
                } else {
                    testCases.push(testCase);
                }
            });
        } else {
            testCases.push([from, to]);
        }
    });
    testCases = [...testCases, ...testCaseData.split(/\r?\n/).map((entry) => entry.split(","))];
    const total = testCases.length;
    let pass = 0, fail = 0;
    for (let rowNum = 0; rowNum < total; rowNum++) {
        const [source, target] = testCases[rowNum];
        const result = retrievePermanentUrl(source);
        if (!result) {
            logger.error(`Failed: ${rowNum + 1}: Source: ${source} Expected: ${target} - No matching pattern find`);
            fail++;
        } else if (result.resultUrl !== target) {
            logger.error(`Failed: ${rowNum + 1}: Source: ${source} Expected: ${target} Got: ${result.resultUrl}`);
            fail++;
        } else {
            logger.log(`Passed: ${rowNum + 1}: Source: ${source}`);
            pass++;
        }
    }
    logger.log(`Total - Passed: ${pass}, Failed: ${fail}`);
}

executeTests();