/**
 * Match matching groups in a regular expression.
 */
var MATCHING_GROUP_REGEXP = /\\.|\((?:\?<(.*?)>)?(?!\?)/g;

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Object} options
 * @return {RegExp}
 * @api private
 */

module.exports = function pathToRegexp(path, keys, options) {
    options = options || {};
    keys = keys || [];
    let extraOffset = 0, keysOffset = keys.length, i = 0, name = 0, pos = 0, backtrack = '', m;
    path = path.replace(/\?/g, '\\?').replace(/&/g, '\\&');
    path = path.replace(
        /\\.|(\/)?(\.)?:(\w+)(\(.*?\))?(\*)?(\?)?|[.*]|\/\(/g,
        function (match, slash, format, key, capture, star, optional, offset) {
            pos = offset + match.length;

            if (match[0] === '\\') {
                backtrack += match;
                return match;
            }

            if (match === '.') {
                backtrack += '\\.';
                extraOffset += 1;
                return '\\.';
            }

            backtrack = slash || format ? '' : path.slice(pos, offset);

            if (match === '*') {
                extraOffset += 3;
                return '(.*)';
            }

            if (match === '/(') {
                backtrack += '/';
                extraOffset += 2;
                return '/(?:';
            }

            slash = slash || '';
            format = format ? '\\.' : '';
            optional = optional || '';
            capture = capture ?
                capture.replace(/\\.|\*/, function (m) { return m === '*' ? '(.*)' : m; }) :
                (backtrack ? '((?:(?!/|' + backtrack + ').)+?)' : '([^/' + format + ']+?)');

            keys.push({
                name: key,
                optional: !!optional,
                offset: offset + extraOffset
            });

            var result = '(?:'
                + format + slash + capture
                + (star ? '((?:[/' + format + '].+?)?)' : '')
                + ')'
                + optional;

            extraOffset += result.length - match.length;

            return result;
        });

    // This is a workaround for handling unnamed matching groups.
    while (m = MATCHING_GROUP_REGEXP.exec(path)) {
        if (m[0][0] === '\\') continue;

        if (keysOffset + i === keys.length || keys[keysOffset + i].offset > m.index) {
            keys.splice(keysOffset + i, 0, {
                name: name++, // Unnamed matching groups must be consistently linear.
                optional: false,
                offset: m.index
            });
        }

        i++;
    }

    path += options.strict ? '' : path[path.length - 1] === '/' ? '?' : '/?';

    // If the path is non-ending, match until the end or a slash.
    if (options.end !== false) {
        path += '$';
    } else if (path[path.length - 1] !== '/') {
        path += options.lookahead !== false ? '(?=/|$)' : '(?:/|$)';
    }

    return new RegExp('^' + path, options.sensitive ? '' : 'i');
};