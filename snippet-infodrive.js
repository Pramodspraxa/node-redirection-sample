const cache = {
    staticRedirections: null,
    tradePorts: null,
    countryFilterMapping: null,
    lastFetched: 0, // Timestamp of last fetch
    cacheDuration: 60 * 60 * 1000, // Cache for 1 hour (3600000ms)
  };
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://volza.com/", // Set as if it's a page visit
    "Connection": "keep-alive"
  }
  async function loadCacheData() {
    const baseUrl = "https://bugfix-www.volza.com/";
    const now = Date.now();

    if (!cache.staticRedirections || !cache.tradePorts || !cache.countryFilterMapping || now - cache.lastFetched > cache.cacheDuration) {
        const [staticRedirectionRes, tradePortsRes, countryMappingRes] = await Promise.all([
            fetch(`${baseUrl}static-redirections-infodrive.json`, { headers: headers }),
            fetch(`${baseUrl}ports.json`, { headers: headers }),
            fetch(`${baseUrl}countryfiltermapping.json`, { headers: headers })
        ]);

        if (staticRedirectionRes.ok) cache.staticRedirections = await staticRedirectionRes.json();
        if (tradePortsRes.ok) cache.tradePorts = await tradePortsRes.json();
        if (countryMappingRes.ok) cache.countryFilterMapping = await countryMappingRes.json();

        cache.lastFetched = now; // Update fetch timestamp
    }
}

  export default {
    async fetch(request, response, next) {
        await loadCacheData();
        if (!cache.staticRedirections || !cache.tradePorts || !cache.countryFilterMapping) {
          return new Response("Data not available.", { status: 500 });
        }
        const lists = [];
        if (cache.staticRedirections) {
          lists.push(cache.staticRedirections);
        }
        redirector.configure(lists);
        return redirector.fetch(request, response, next);
    },
  };

  const redirector = {
    redirectUrl: "https://bugfix-www.volza.com/{statusCode}",
    domainPrefix: "https://bugfix-www.volza.com",
    statusHandler: null,

    async fetch(request, response, next) {
      const requestURL = new URL(request.url);
      const result = redirector.retrievePermanentUrl(requestURL.pathname);
      //TODO get it checked if this is correct way to check if it is cloudflare
      const isCloudflare = typeof globalThis.Cloudflare !== 'undefined' || request.headers.get('CF-Connecting-IP');
      if (Response && isCloudflare) {
        response = Response;
      }
      if (!result?.resultUrl) {
        if (next != undefined && typeof next === 'function' ) {
          return next();
        }
        // If request path not in map, return the original request.
        return fetch(request);
      }
      let resultUrl = result.resultUrl;
      if (typeof resultUrl === 'number') {
        if (redirector.statusHandler) {
          return redirector.statusHandler(request, response, next);
        }
        return response.redirect(redirector.redirectUrl.replace("{statusCode}", resultUrl.toString()), resultUrl);
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

    retrievePermanentUrl: function (source) {
      const ruleList = this.permanentRedirectionList;
      for (const rule of ruleList) {
        //Try matching the URL pattern with source
        const match = rule.regexp.exec(source);
        if (match) {
          const params = rule.keys.reduce((acc, key, index) => {
            acc[key.name] = match[index + 1] ? decodeURIComponent(match[index + 1]) : match[index + 1];
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
  var MATCHING_GROUP_REGEXP = /\\.|\((?:\?<(.*?)>)?(?!\?)/g;

  function pathToRegexp(path, keys, options) {
    options = options || {};
    keys = keys || [];
    let extraOffset = 0, keysOffset = keys.length, i = 0, name = 0, pos = 0, backtrack = '', m;
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

  const hsCodeWithOrKeyword = /^(\d{4,8})-or-hscode$/;
  const hsCodeKeywordRegex = /^(\d{4,8})-hscode$/;
  const redirectUrl = 'https://bugfix-www.volza.com';
  const wordPressSiteRedirectUrl = 'https://infodriveindia.in';
  const infodriveUrl = 'https://www.infodriveindia.com';

  const util = {
    replacement: ({ params, rule }) => {
      const { to: pattern } = rule;
      const { keyword, hscode } = params;
      if (params.keyword) {
        if (hsCodeWithOrKeyword.test(params.keyword)) {
          params.keyword = `hsn-code-${keyword.replace(hsCodeWithOrKeyword, '$1')}`;
        }
        else if (hsCodeKeywordRegex.test(params.keyword)) {
          params.keyword = `hsn-code-${keyword.replace(hsCodeKeywordRegex, '$1')}`;
        }
        else {
          params.keyword = util.cleanKeyword(params.keyword);
        }
      }
      if (params.keyword1) {
        params.keyword1 = util.cleanKeyword(params.keyword1);
      }
      if (params.keyword2) {
        params.keyword2 = util.cleanKeyword(params.keyword2);
      }
      if (params.COO) {
        params.COO = util.parseCountryName(params.COO);
      }
      if (params.COD) {
        params.COD = util.parseCountryName(params.COD);
      }
      if (params.product) {
        params.product = util.cleanKeyword(params.product);
      }
      if (params.country) {
        params.country = util.parseCountryName(params.country, true);
      }
      if (params.countryWODefault) {
        params.countryWODefault = util.parseCountryName(params.countryWODefault, false);
      }
      if (params.country2WODefault) {
        params.country2WODefault = util.parseCountryName(params.country2WODefault, false);
      }
      if (params.countryFilterMap) {
        params.countryFilterMap = util.getCountryFilterMapping(params.countryFilterMap.split('/')[0]);
      }
      if (params.expImp) {
        params.importInOrExportTo = params.expImp === 'import' ? 'import-in' : 'export-from';
        params.secondCountryPrefix = params.expImp === 'import' ? 'coo' : 'cod';
        params.ofOrFrom = params.expImp === 'import' ? 'of' : 'from';
      }
      params.volzaUrl = redirectUrl;
      params.wordpressUrl = wordPressSiteRedirectUrl;
      params.infodriveUrl = infodriveUrl;
      params.hsCodeOrKeyword = hscode?.length >= 3 ? `hsn-code-${hscode}` : util.cleanKeyword(keyword);

      return pattern.replace(/\{(\w+)\}/g, (_, key) => params[key] || '');
    },
    usCodMapper({ params }) {
      const { expImp, country, keyword } = params;
      const buyerSupplier = expImp == "importer" ? "buyers" : "manufacturers";
      const secondCountryPrefix = expImp == "importer" ? "coo" : "cod";
      if (country && !util.removeSpecialCharacterSearch.includes(country)) {
        return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/${buyerSupplier}-in-${util.parseCountryName(country)}/${secondCountryPrefix}-united-states/`;
      }
      return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/${buyerSupplier}-in-united-states/`;
    },
    usManufacturerCodMapper({ params }) {
      const { fc, product } = params;
      const countryname = util.parseCountryName(fc);
      if (util.removeSpecialCharacterSearch.includes(countryname)) {
        return `/p/${util.cleanKeyword(product)}/manufacturers/cod-united-states/`;
      }
      return `/p/${util.cleanKeyword(product)}/manufacturers${countryname ? `/manufacturers-in-${countryname}` : ''}/cod-united-states/`;
    },
    usCooMapper({ params }) {
      const { expImp, country, keyword } = params;
      const buyerSupplier = expImp == "importers" ? "buyers" : "manufacturers";
      const secondCountryPrefix = expImp == "importers" ? "coo" : "cod";
      if (country && !util.removeSpecialCharacterSearch.includes(country)) {
        return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/${buyerSupplier}-in-united-states/${secondCountryPrefix}-${util.parseCountryName(country)}/`;
      }
      return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/${buyerSupplier}-in-united-states/`;
    },
    usImpExpMapper({ params }) {
      const { expImp, country, keyword } = params;
      const importInOrExportTo = expImp == "import" ? "import-in" : "export-from";
      const secondCountryPrefix = params.expImp === 'import' ? 'coo' : 'cod';
      const countryName = util.parseCountryName(country);
      if (countryName) {
        return `/p/${util.cleanKeyword(keyword)}/${expImp}/${importInOrExportTo}-united-states/${secondCountryPrefix}-${countryName}/`;
      }
      return `/p/${util.cleanKeyword(keyword)}/${expImp}/${importInOrExportTo}-united-states/`;
    },
    indianCustomsPortData({ params }) {
      let { portName, icd } = params;
      const { expImp } = params;
      const isImport = expImp == "import";
      portName = portName.replace(/-/g, ' ');
      if (icd) {
        if (icd == '_ppg') {
          icd += ' icd';
        }
        portName += ` ${icd.replace(/_/g, '')}`;
      }
      const { country: portCountry, code: portCode } = util.findCountryByPort(portName);
      if (portCode && portCountry) {
        return `/global-trade-data/${portCountry.toLowerCase()}-${expImp}-trade-data/${expImp}s/${isImport ? 'pod' : 'poo'}-port-${portName.replace(/ /g, '+')}-${portCode}/`;
      }
      return `/ports/india-ports/`;
    },
    buyerSupplierMapper({ params }) {
      const { expImp, keyword, country } = params;
      const buyerSupplier = expImp === 'import' ? 'buyers' : 'manufacturers';
      return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/${buyerSupplier}-in-${util.parseCountryName(country, true)}/`;
    },
    parseCountryName(country, returnDefault) {
      if ((!country || ['n/a', 'not-available', 'not_available', 'na'].indexOf(country) > -1)) {
        return returnDefault ? 'global' : '';
      }
      if (country === 'korea') return 'north-korea';
      country = country.replace(/[ _]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
      country = (cache.countryFilterMapping[country] || country).replace(/ /g, '-').split('/')[0].toLowerCase();
      return country || '';
    },
    cleanKeyword: (keyword) => {
      if (!keyword) {
        return keyword;
      }
      let toReturn = keyword.replace(/[^a-zA-Z0-9]/g, '-').replace(/--+/g, '-');
      if (toReturn[0] === '-') {
        toReturn = toReturn.substring(1);
      }
      if (toReturn[toReturn.length - 1] === '-') {
        toReturn = toReturn.substring(0, toReturn.length - 1);
      }
      return toReturn.toLowerCase();
    },
    removeSpecialCharacterSearch: ["not-available", "not available", "not_available"],
    findCountryByPort: (port) => {
      const [code, country] = cache.tradePorts[port] || ['', ''];
      return { country, code };
    },
    getCountryFilterMapping: (country) => {
      if (!country) {
        return "";
      }
      //first replace space and underscore with hyphen, then replace multiple continuous hyphens with single hyphen and then remove leading and trailing hyphens.
      let toReturn = country.replace(/[ _]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
      toReturn = toReturn.replace(/^from-/, '');//remove "from-" prefix from the start of string as it comes for multiple countries.
      toReturn = (cache.countryFilterMapping[toReturn] || toReturn).replace(/ /g, '-').toLowerCase();
      if (toReturn === 'n/a' || toReturn === 'not-available' || toReturn === 'na') {
        toReturn = '';
      }
      return toReturn;
    }
  }
