const { util } = require('./dynamicRedirectionsInfodrive');
const pathToRegexp = require('./path-to-regexp');

const redirector = {
    redirectUrl: "https://www.volza.com/{statusCode}",
    domainPrefix: "https://www.volza.com",

    statusHandler: null,

    async fetch(request, response, next) {
        const result = redirector.retrievePermanentUrl(request.url);
        if (Response) {
            //response = Response; TODO Discuss how we can handle or debug with cloudflare 
        }
        if (!result?.resultUrl) {
            if (next) {
                return next();
            }
            return fetch(request);
        }
        let resultUrl = result.resultUrl;
        if (typeof resultUrl === 'number') {
            if (redirector.statusHandler) {
                return redirector.statusHandler(request, response, next);
            }
            return response.redirect(redirector.redirectUrl.replace("{statusCode}", resultUrl), resultUrl);
        }
        if (!resultUrl.startsWith('https://')) {
            resultUrl = `${redirector.domainPrefix}${resultUrl}`;
        }
        return response.redirect(resultUrl, 301);
    },

    configure: function (urlLists) {
        const finalList = [];
        for (const list of urlLists) {
            list.forEach(entry => {
                if (Array.isArray(entry)) {
                    finalList.push({ from: entry[0], to: entry[1] });
                } else {
                    finalList.push(entry);
                }
            });
        }
        finalList.forEach(rule => {
            rule.keys = [];
            rule.regexp = pathToRegexp(rule.from, rule.keys, { end: true });
        });
        this.permanentRedirectionList = finalList;
    },

    logger: console,

    retrievePermanentUrl : function(source) {
        const ruleList = this.permanentRedirectionList;
        for (const rule of ruleList) {
            //Try matching the URL pattern with source
            const match = rule.regexp.exec(source);
            if (match) {
                const params = rule.keys.reduce((acc, key, index) => {
                    acc[key.name] = match[index + 1] ? decodeURIComponent(match[index + 1]): match[index + 1];
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
    }
}

// identify is this cloudflare
if (process.env.ENVIRONMENT === 'Production') {
    const baseUrl = "https://cloudflare.com";
    const listUrls = ['static.json'];
    const lists = [];
    for (const listUrl of listUrls) {
        list.push(JSON.parse(fetch(`${baseUrl}${listUrl}`)))
    }
    redirector.configure(lists);
}

module.exports = redirector;

/*
const redirector = require('redirector');

staticJson = fs.read(....)

redirector.statusHandler = function(statusCode, req, res, next) {

}
redirector.configure([staticList, dynamicList]);

expres.use(redirector.expressMiddleware);
*/