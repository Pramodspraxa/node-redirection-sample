const countryFilterMapping = require('./countryFilterMapping.js');
const tradePorts = require('./ports.js');
const countryLookup = require('./countryLookup.js');

const regexToReplaceKeywords = /(_|-| )/g;
const hsCodeWithOrKeyword = /^(\d{4,8})-or-hscode$/;
const hsCodeKeywordRegex = /^(\d{4,8})-hscode$/;
const hsnVariation = /^(\d{4,8})hscode$/;
const regexOfKeywordAndHSN = /^(?<product>.*?)\s+and\s+hscode\s+(?<hsn>\d+)$/;
const numericRegex = /^[0-9]+$/;
const redirectUrl = 'https://www.volza.com';//process.env.NEXT_PUBLIC_REBRAND_URL || 'https://www.volza.com';//TODO change to www.volza.com
const wordPressSiteRedirectUrl = 'https://infodriveindia.in';
const infodriveUrl = 'https://www.infodriveindia.com';
const tabwiseText = {
    "importers-buyers": "buyers",
    "exporters-suppliers": "manufacturers",
    "import-data": "imports",
    "export-data": "exports"
};
const portPrefixMap = {
    "importers-buyers": "pod-",
    "exporters-suppliers": "poo-",
    "import-data": "pod-",
    "export-data": "poo-"
}
const expImpTypeMap = {
    "importers-buyers": "import",
    "exporters-suppliers": "export",
    "import-data": "import",
    "export-data": "export"
}
const invalidCountries = ['na', 'global', 'global-exporters-importers-export', 'others'];
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
        country = (countryFilterMapping[country] || country).replace(/ /g, '-').split('/')[0].toLowerCase();
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
        const [code, country] = tradePorts[port] || ['', ''];
        return { country, code };
    },
    getCountryFilterMapping: (country) => {
        if (!country) {
            return "";
        }
        //first replace space and underscore with hyphen, then replace multiple continuous hyphens with single hyphen and then remove leading and trailing hyphens.
        let toReturn = country.replace(/[ _]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
        toReturn = toReturn.replace(/^from-/, '');//remove "from-" prefix from the start of string as it comes for multiple countries.
        toReturn = (countryFilterMapping[toReturn] || toReturn).replace(/ /g, '-').toLowerCase();
        if (toReturn === 'n/a' || toReturn === 'not-available' || toReturn === 'na') {
            toReturn = '';
        }
        return toReturn;
    }
}

const dynamicRedirections = [
    ['/companies/saranya-foods-exports--------79-386742.aspx', '/companies/saranya-foods-exports-79-386742.aspx'],
    ['/companies/sada-impex-------------------241-386805.aspx', '/companies/sada-impex-241-386805.aspx'],
    ['/companies/richmont-goods--services-pvt-ltd-369890.aspx', '/companies/richmont-goods-services-pvt-ltd-369890.aspx'],
    ['/us-importers/:keyword-importers/foreign-port-:fp/us-port-:lp/foreign-country-not-available.aspx', '/p/{keyword}/buyers/buyers-in-united-states/'],
    ['/us-importers/:keyword-:expImp(importers)/foreign-port-:port/us-port-:usPort/foreign-country-:countryFilterMap.aspx', '/p/{keyword}/buyers/buyers-in-united-states/coo-{countryFilterMap}/'],
    ['/us-importers/:keyword-importers/:countryPortType(foreign-country|us-port|foreign-port)-:countryPortName.aspx',
        ({ params }) => {
            const { keyword, countryPortType, countryPortName } = params;
            if (countryPortType === 'foreign-country') {
                return `/p/${util.cleanKeyword(keyword)}/buyers/buyers-in-united-states/coo-${util.parseCountryName(countryPortName)}/`;
            }
            return `/p/${util.cleanKeyword(keyword)}/buyers/buyers-in-united-states/`;
        }
    ],
    ['/us-importers/:keyword-importers.aspx', '/p/{keyword}/buyers/buyers-in-united-states/'],
    ['/us-importers/:keyword-importers/foreign-country-:COO?(/foreign-port-:fp)?(/us-port-:lp)?.aspx', '/p/{keyword}/buyers/buyers-in-united-states/coo-{COO}/'],
    ['/us-importers/:product-importers/foreign-port-:fp?(/foreign-country-:fc)?(/us-port-:lp)?.aspx',
        ({ params }) => {
            const { fc, product } = params;
            const cleanCountry = util.getCountryFilterMapping(fc);
            if (cleanCountry) {
                return `/p/${util.cleanKeyword(product)}/buyers/buyers-in-united-states/coo-${cleanCountry}/`;
            }
            return `/p/${util.cleanKeyword(product)}/buyers/buyers-in-united-states/`;
        }
    ],
    ['/exporter-to-us/:keyword-exporter-export-to-us/((:portType(us|foreign)-port)|(foreign-country))-:portCountryName.aspx',
        ({ params }) => {
            const { portType, keyword, portCountryName } = params;
            let urlToRedirect = `/p/${util.cleanKeyword(keyword)}/manufacturers/`;
            if (!portType) {
                const country = util.getCountryFilterMapping(portCountryName);
                if (country) {
                    urlToRedirect += `manufacturers-in-${country}/`;
                }
            }
            return `${urlToRedirect}cod-united-states/`;
        }
    ],
    ['/exporter-to-us/:keyword-exporter-export-to-us.aspx', '/p/{keyword}/manufacturers/cod-united-states/'],
    ['/exporter-to-us/:product-exporter-export-to-us/foreign-port-:fp?(/us-port-:lp)?(/foreign-country-:fc)?(/us-port-:lp2)?.aspx', "$usManufacturerCodMapper"],
    ['/exporter-to-us/:product-(exporter-)?export-to-us/us-port-:lp/foreign-port-:fp?(/foreign-country-:fc)?.aspx', "$usManufacturerCodMapper"],
    ['/exporter-to-us/:product-exporter-export-to-us(/us-port-:lp)?/foreign-country-:fc?(/foreign-port-:fp)?(/us-port-:lp2)?(/foreign-port-:fp2)?.aspx', "$usManufacturerCodMapper"],
    ['/top-products/top-import-products-of-:countryFilterMap', '/top-products/top-import-products-of-{countryFilterMap}/'],
    ['/top-products/top-export-products-from-:countryFilterMap', '/top-products/top-export-products-from-{countryFilterMap}/'],
    ['/us-importers/:keyword-importers/us-port-:port/foreign-port-:fp.aspx', '/p/{keyword}/buyers/coo-united-states/'],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/foreign-port-:foreginPort)?(/us-port-:usPort)?(/foreign-country-:country)?.aspx', "$usCooMapper"],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/us-port-:usPort)?(/foreign-country-:country)?(/foreign-port-:foreginPort)?.aspx', "$usCooMapper"],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/us-port-:usPort)?(/foreign-port-:foreginPort)?(/foreign-country-:country)?.aspx', "$usCooMapper"],
    ['/global-products/:keyword.aspx', "/export-import-products/{keyword}-01/"],
    ['/:expImp(exporter|importer)-to-us/?(:keyword-export-to-us)?(/foreign-country-:country)?(/us-port-:port)?.aspx', "$usCodMapper"],
    ['/companies/:companyName:dash([-]{2,20}):name2-:id.aspx', '/companies/{companyName}-{name2}-{id}.aspx'],
    ['/hs-codes/:hsCode([0-9]{2})-chapter-:chapter([0-9]{1,2})-:chapterUrl.aspx',
        ({ params }) => {
            const { chapterUrl, chapter } = params;
            return `/hs-codes/chapter-${chapter.replace(/\b([0-9])\b/gmi, `0$1`)}-${chapterUrl}/`;
        }
    ],
    ['/hs-codes/:hsCode([0-9]{4,8})-:hsDescription.aspx', '/hs-codes/{hsCode}-{hsDescription}/'],
    ['/:subUrl(india-ports-customs|ports)/:portName-:expImp(export|import)s.aspx',
        ({ params }) => {
            const portName = params.portName.replace(/-/g, ' ');
            const { country: portCountry, code: portCode } = util.findCountryByPort(portName);
            if (portCode && portCountry) {
                return `/global-trade-data/${portCountry.toLowerCase()}-export-import-trade-data/search/port-${portName.replace(/ /g, '-')}-${portCode}/`;
            }
            return `/ports/india-ports/`;
        }
    ],
    ['/:folder(global-trade-data|global-products|hs-codes|ports|companies|us-importers|trading-partners|top-products|exporter-to-us):subfolder(*)',
        ({ params }) => {
            const { subfolder, folder } = params;
            return `/${folder === 'global-products' ? 'export-import-products' : folder}${subfolder}${subfolder.includes('.aspx') ? '' : '/'}`;
        }
    ],
    ['/company/:keyword([a-zA-Z]{1})-:pageNo([0-9]{1,5})', '/company/{keyword}-{pageNo}/'],
    ['/companys/:search([0-9a-zA-Z-&+]{3,100})-:pageNo([0-9]{1,5})', '/company/{search}-{pageNo}/'],
    ['/company/:companyName([^\/]+?)-:companyId([0-9]{1,10})', '/company-profile/{companyName}-{companyId}/'],
    ['/companyg/:groupName([^\/]+?)-:pageNo([0-9]{1,5})',
        ({ params }) => {
            return `/company/${params.groupName.substring(0, 1)}-01/`;
        }
    ],
    ['/traderesources/port:pageNo([0-9]{2,5}).aspx', `/ports/`],
    ['/products/:keyword.aspx', '/p/{keyword}/'],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expImp2(import|export)-data.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expImp2(import|export)/fc-:country([a-zA-Z_/-]{1,40})-report.aspx',
        ({ params }) => {
            const { hsCode, expImp } = params;
            const country = util.parseCountryName(params.country);
            const isImport = expImp === 'import';
            return `/p/hsn-code-${hsCode}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${country && country !== 'n/a' ? (isImport ? `coo-${country}/` : `cod-${country}/`) : ''}`;
        }
    ],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expImp2(import|export)/fp-:portName([a-zA-Z_/-]{1,40})-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/'],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)-data.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expoImpo(import|export)/hscode-:hs/lp-:name-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/hscode-:hsCode/lp-:port-report.aspx',
        ({ params }) => {
            const { expImp, hsCode, } = params;
            const keyword = util.cleanKeyword(params.keyword);
            return `/p/` + (keyword.length >= 3 ? `${keyword}/` : '') + `${expImp}/${expImp === 'export' ? 'export-from' : 'import-in'}-india/` + (hsCode && hsCode.length >= 4 ? `hsn-code-${hsCode}/` : '');
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/hscode-:hsCode-report.aspx',
        ({ params }) => {
            const { hsCode, expImp, keyword } = params;
            const isHS = hsCodeKeywordRegex.test(keyword);
            return `/p/${isHS ? `${keyword.replace(hsCodeKeywordRegex, 'hsn-code-$1')}` : util.cleanKeyword(keyword)}/${expImp}/${expImp === 'export' ? 'export-from' : 'import-in'}-india/` + (!isHS && hsCode.length >= 4 ? `hsn-code-${hsCode}/` : '');
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fc-:country/:port-report.aspx',
        ({ params }) => {
            const { keyword, expImp, port } = params;
            const isImport = expImp === "import";
            const country = util.parseCountryName(params.country);
            const hsCodeFilter = port.indexOf("hscode") > - 1 ? `hsn-code-${port.split('-').length > 1 ? port.split('-')[1] : port.split('-')[0]}/` : '';
            const secondCountryFilter = country ? `${isImport ? 'coo' : 'cod'}-${country}/` : '';
            if ((keyword.indexOf("hscode") > -1 || keyword.length < 3) && hsCodeFilter) {
                return `/p/${hsCodeFilter}${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${secondCountryFilter}`;
            }
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${hsCodeFilter}${secondCountryFilter}`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fc-:country([a-zA-Z_/-]{1,40})-report.aspx',
        ({ params }) => {
            const { expImp, keyword } = params;
            const isImport = expImp == "import";
            const country = util.parseCountryName(params.country);
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${country ? `${isImport ? 'coo' : 'cod'}-${country}/` : ''}`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/lp-:port-report.aspx',
        ({ params }) => {
            const { keyword, expImp } = params;
            return `/p/${hsCodeKeywordRegex.test(keyword) ? `${keyword.replace(hsCodeKeywordRegex, 'hsn-code-$1')}` : util.cleanKeyword(keyword)}/${expImp}/${expImp == "import" ? 'import-in' : 'export-from'}-india/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fc-:country([a-zA-Z_/-]{1,40})/hscode-:hsCode-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fc-:country([a-zA-Z_/-]{1,40})/hscode-:hsCode/lp-:port-report.aspx',
        ({ params }) => {
            const { expImp, hsCode } = params;
            const isImport = expImp == "import";
            const country = util.parseCountryName(params.country)
            const keyword = util.cleanKeyword(params.keyword);
            if (keyword.indexOf('hscode') === -1 && keyword.length >= 3) {
                const hsCodeFilter = hsCode.length >= 3 ? `hsn-code-${hsCode}/` : '';
                return `/p/${keyword}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${hsCodeFilter}${country ? `${isImport ? 'coo' : 'cod'}-${country}/` : ''}`;
            }
            return `/p/hsn-code-${hsCode.length >= 3 ? hsCode : keyword.split('-')[0]}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${country ? `${isImport ? 'coo' : 'cod'}-${country}/` : ''}`;
        }
    ],
    ['/indian-:importerExporter(importers|exporters)/:keyword-:importerExporter2(importers|exporters).aspx',
        ({ params }) => `/p/${util.cleanKeyword(params.keyword)}/${params.importerExporter === 'importers' ? 'buyers' : 'manufacturers'}/${params.importerExporter === 'importers' ? 'buyers' : 'manufacturers'}-in-india/`
    ],
    ['/us-import-data/:keyword-import-data.aspx', '/p/{keyword}/import/import-in-united-states/'],
    ['/us-import-data/foreign-port-:fp-export-to-us.aspx',
        ({ params }) => `/p/${util.cleanKeyword(params.fp).replace(regexToReplaceKeywords, '-or-')}/buyers/buyers-in-united-states/`
    ],
    ['/us-import-data/foreign-port-:fp-export-to-us/:countryPortType(foreign-country|us-port)-:countryPortName.aspx',
        ({ params }) => {
            const { countryPortType } = params;
            if (countryPortType === 'us-port') {
                return `/top-products/top-import-products-of-united-states/`;//no mapping in trade-resource-port table for us ports, so after discussion with IIPL Team, redirecting these to us import shipment data page on global search
            }
            return `/p/${util.cleanKeyword(params.fp).replace(regexToReplaceKeywords, '-or-')}/buyers/buyers-in-united-states/`;
        }
    ],
    ['/us-import-data/foreign-port-:fport-export-to-us/foreign-country-:country/us-port-:lport.aspx', '/top-products/top-import-products-from-{country}-to-united-states/'],
    ['/us-import-data/foreign-port-:fp-export-to-us/foreign-country-:fc/us-port-:portName.aspx', '/global-trade-data/united-states-import-trade-data/imports/'],
    ['/us-import-data/foreign-port-:fp-export-to-us/us-port-:portName/foreign-country-:fc.aspx', '/top-products/top-export-products-from-{fc}-to-united-states/'],
    ['/us-import-data/us-port-:fp-united-states-import.aspx', '/p/{fp}/import/'],
    ['/us-import-data/:keyword-import/((:portType(us|foreign)-port)|(foreign-country))-:portCountryName.aspx',
        ({ params }) => {
            const { portType, keyword } = params;
            let urlToRedirect = `/p/${keyword.replace(regexToReplaceKeywords, '-')}/import/import-in-united-states/`;
            if (!portType) {
                let portCountryName = util.getCountryFilterMapping(params.portCountryName);
                urlToRedirect += `coo-${portCountryName}/`;
            }
            return urlToRedirect;
        }
    ],
    ['/india-:expImp(import|export)-data/:code-hscode-:expoImpo(import|export)/fc-:title/lp-:name-report.aspx', '/p/hsn-code-{code}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:code-hscode-:expoImpo(import|export)/fp-:title/hscode-:hsCode-report.aspx', '/p/hsn-code-{code}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:keyword-:expoImpo(import|export)/hscode-:hsCode/lp-:name-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:keyword-:expoImpo(import|export)/fc-:title/lp-:name-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/us-import-data/:keyword-import/foreign-country-:countryFilterMap.aspx', '/p/{keyword}/buyers/buyers-in-{countryFilterMap}/coo-united-states/'],
    ['/india-trading-partners/:country-:expImp(imports|exports).aspx',
        ({ params }) => {
            const country = util.parseCountryName(params.country, true);
            const [from, to] = (params.expImp === 'imports') ? ["india", country] : [country, "india"];
            return `/top-products/top-${params.expImp === 'imports' ? 'import' : 'export'}-products-from-${from}-to-${to}/`;
        }
    ],
    ['/:country-:expImp(import|export)s-trade-data.aspx', '/global-trade-data/{country}-{expImp}-trade-data/'],
    ['/(:countryFilterMap)_:expImp(import|export)s_trade_data.aspx', '/global-trade-data/{countryFilterMap}-{expImp}-trade-data/'],
    ['/(:country)_(:keyword)_:expImp(import|export)ers.aspx', "$buyerSupplierMapper"],
    ['/(:country)-(:keyword)-:expImp(import|export)ers.aspx', "$buyerSupplierMapper"],
    ['/exim/indian-customs/(:portName)_customs:icd(_icd|_air|_sea|_ppg)?_:expImp(export|import)_data.aspx', "$indianCustomsPortData"],
    ['/indian-customs/(:portName)-customs-:expImp(export|import)-data.aspx', "$indianCustomsPortData"],
    ['/global-export-import-data-:keyword', '/p/{keyword}/'],
    ['/:country-:expImp(import|export)-data-:keyword-hscode-:hscode',
        ({ params }) => {
            const { expImp, keyword, hscode } = params;
            const country = util.getCountryFilterMapping(params.country);
            let urlToRedirect = `/p/${util.cleanKeyword(keyword)}/${expImp.toLowerCase()}/`;
            if (country) {
                urlToRedirect += `${expImp === 'export' ? `export-from-${country}/` : `import-in-${country}/`}`
            }
            if (hscode) {
                urlToRedirect += `hsn-code-${hscode}/`;
            }
            return urlToRedirect;
        }
    ],
    ['/shipment-data-global-exporters-importers-export-import-data-of-:keyword', '/p/{keyword}/'],
    ['/:countryFilterMap-:expImp(import|export)-data-:keyword', '/p/{keyword}/{expImp}/{importInOrExportTo}-{countryFilterMap}/'],
    ['/(:country)_:expImp(import|export)_trade_data.aspx', '/global-trade-data/{country}-{expImp}-trade-data/'],
    ['/topexportimportproducts/:expImp(import|export).aspx', '/top-products/top-{expImp}-products-{ofOrFrom}-india/'],
    ['/india-:expImp(import|export)-data/:product-(export|import)/fc-:country/hscode-:code/lp-:port/unit-:unitType-report.aspx',
        ({ params }) => {
            const { expImp } = params;
            const country = util.parseCountryName(params.country);
            let product = util.cleanKeyword(params.product);
            const isImport = expImp === 'import', importInOrExportFrom = isImport ? 'import-in' : 'export-from';
            if (product.length >= 3) {
                if (hsCodeKeywordRegex.test(product)) {
                    product = product.replace(hsCodeKeywordRegex, 'hsn-code-$1');
                    params.code = "";
                }
                return `/p/${product}/${expImp}/${importInOrExportFrom}-india/${params.code && params.code.length > 1 ? `hsn-code-${params.code}/` : ''}${country && invalidCountries.indexOf(country) === -1 ? `${isImport ? 'coo' : 'cod'}-${country}/` : ''}`;
            }
            if (params.code && params.code.length >= 3) {
                return `/p/hsn-code-${params.code}/${expImp}/${importInOrExportFrom}-india/${isImport ? 'coo' : 'cod'}-${country}/`;
            }
            if (params.country) {
                return `/top-products/top-${expImp}-products-from-india-to-${country}/`;
            }
            return `/top-products/top-${expImp}-products-${isImport ? 'of' : 'from'}-india/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-export/unit-:unit-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expImp(import|export)/:date/:port-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/shipment-data/:country/lp-:port-:expImp(import|export)-data-of-:keyword', '/p/{keyword}/{expImp}/coo-{country}/'],
    ['/shipment-data/india-exporters-suppliers-of-hscode-:hsCode-to-:COD/lp-:port', '/p/hsn-code-{hsCode}/manufacturers/manufacturers-in-india/cod-{COD}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/foreign-country-:country/us-port-:lport/foreign-port-:fport.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/{secondCountryPrefix}-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/us-port-:lport/foreign-country-:country/foreign-port-:fport.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/{secondCountryPrefix}-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/us-port-:lport/foreign-port-:fport.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/us-port-:lport/foreign-country-:country.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/{secondCountryPrefix}-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)(/us-port-:lport)?/foreign-country-:country/foreign-port-:fport.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/{secondCountryPrefix}-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)(/us-port-:lport)?/foreign-port-:fport/foreign-country-:country.aspx', '$usImpExpMapper'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)(/foreign-country-:country)?/foreign-port-:fport/us-port-:lport.aspx', '$usImpExpMapper'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/foreign-port-:fport/us-port-:lport/foreign-country-:country.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/{secondCountryPrefix}-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)(/foreign-port-:fport)?/foreign-country-:country/us-port-:lport.aspx', '$usImpExpMapper'],
    ['/india-:impExp(export|import)-data/:hscode-hscode-:expImp2(export|import)/fc-:country/hscode-:hs2/month-:monthYear/lp-:localPort/unit-:unit-report.aspx',
        ({ params }) => {
            const { country, hscode, hs2 } = params;
            return `/p/hsn-code-${hscode && hscode.length >= 3 ? hscode : hs2}/coo-india/cod-${util.parseCountryName(country)}/`;
        }
    ],
    ['/india-:impExp(export|import)-data/:data-:expImp2(export|import)/fc-:country/hscode-:hsCode/month-:monthYear/lp-:port-report.aspx',
        ({ params }) => {
            const { impExp, country, hsCode, data } = params;
            const countryName = util.parseCountryName(country);
            const firstCountryPrefix = impExp == 'export' ? "export-from" : "import-in";
            const secondCountryPrefix = impExp == 'export' ? "cod" : "coo";
            if (isNaN(Number(data)) && data.indexOf('hscode') === -1) {
                return `/p/${util.cleanKeyword(data)}/${impExp}/${firstCountryPrefix}-india/${secondCountryPrefix}-${countryName}/`;
            }
            return `/p/${data.indexOf('-hscode') > -1 ? 'hsn-code-' + data.split('-')[0] : `hsn-code-${hsCode}`}/${impExp}/${firstCountryPrefix}-india/${secondCountryPrefix}-${countryName}/`;
        }
    ],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/fp-:foriegnPort/hscode-:hsCode/unit-:unit-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/hscode-:hsCode/month-:monthYear/lp-:port-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/fc-:COD/hscode-:hsCode/month-:monthYear-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{COD}/'],
    ['/india-:expImp(export|import)-data/:hsCode-hscode-:expImp2(export|import)/fp-:forignPort/hscode-:hs2/lp-:port-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(export|import)-data/:hsCode-hscode-:expImp2(export|import)/fc-:COD/hscode-:hs2/unit-:unit-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{COD}/'],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/fc-:COD/fp-:foreignPort/hscode-:hsCode/lp-:port/unit-:unit-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{COD}/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fp-:foreignPort/lp-:port-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:impExp(export|import)-data/:keyword-:expImp2(export|import)/fc-:country/hscode-:hscode/month-:monthYear-report.aspx',
        ({ params }) => {
            const { impExp, country, hscode } = params;
            const keyword = util.cleanKeyword(params.keyword);
            const firstCountry = impExp === 'import' ? 'import-in' : 'export-from';
            const secondCountryPrefix = impExp === 'import' ? 'coo' : 'cod';
            return keyword.length >= 3 ? `/p/${keyword}/${impExp}/${firstCountry}-india/${hscode ? `hsn-code-${hscode}/` : ""}${secondCountryPrefix}-${util.parseCountryName(country)}/` : `/p/hsn-code-${hscode}/${impExp}/${firstCountry}-india/${secondCountryPrefix}-${util.parseCountryName(country)}/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fp-:portName([a-zA-Z_/-]{1,40})-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fp-:foreignPort/hscode-:hscode-report.aspx',
        ({ params }) => {
            const { expImp, hscode, keyword } = params;
            const firstCountry = expImp === 'import' ? 'import-in' : 'export-from';
            if (hscode.length >= 4) {
                return `/p/${util.cleanKeyword(keyword)}/${expImp}/${firstCountry}-india/hsn-code-${hscode}/`;
            }
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/${firstCountry}-india/`;
        }
    ],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fc-:COD/month-:monthYear/lp-:port-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{COD}/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/fc-:country)?(/fp-:foreignPort)?(/hscode-:hscode)?(/lp-:localPort)?(/month-:monthYear)?(/unit-:unit-report)?.aspx',
        ({ params }) => {
            const { expImp, country, hscode } = params;
            const keyword = util.cleanKeyword(params.keyword);
            const firstCountryPrefix = expImp === 'import' ? 'import-in' : 'export-from';
            const cleanKeyword = hsCodeKeywordRegex.test(keyword) ? `${keyword.replace(hsCodeKeywordRegex, 'hsn-code-$1')}` : `${keyword}`;
            if (hscode && hscode.length >= 4 && (country && country == "others" || !country)) {
                if (isNaN(Number(keyword)) && keyword.length > 2) {
                    return `/p/${cleanKeyword}/${expImp}/${firstCountryPrefix}-india/${!hsCodeKeywordRegex.test(keyword) ? `hsn-code-${hscode}/` : ''}`;
                }
                return `/p/hsn-code-${hscode}/${expImp}/${firstCountryPrefix}-india/`;
            }
            if (country && country != "others") {
                const secondCountryPrefix = expImp === 'import' ? 'coo' : 'cod';
                if (cleanKeyword == 'hscode') {
                    return `/p/hsn-code-${hscode}/${expImp}/${firstCountryPrefix}-india/${secondCountryPrefix}-${util.parseCountryName(country)}/`;
                };
                return `/p/${cleanKeyword}/${expImp}/${firstCountryPrefix}-india/${hscode && keyword != '-hscode' && cleanKeyword.indexOf('hsn-code-') < 0 ? `hsn-code-${hscode}/` : ''}${secondCountryPrefix}-${util.parseCountryName(country)}/`;
            }
            return `/p/${cleanKeyword}/${expImp}/${firstCountryPrefix}-india/`;
        }
    ],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fc-:COD/month-:monthYear/lp-:localPort/unit-:unit-report.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{COD}/'],
    ['/india-:expImp(import|export)-data/:keyword-import/hscode-:hscode/month-:monthYear/lp-:port-report.aspx',
        ({ params }) => {
            const { expImp, hscode, keyword } = params;
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/${expImp == 'import' ? "import-in" : "export-from"}-india/` + (hscode?.length >= 4 ? `hsn-code-${hscode}/` : '');
        }
    ],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/foreign-country-:country)?(/us-port-:usPort)?(/foreign-port-:foreginPort)?.aspx', "$usCooMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-country-:country)?(/foreign-port-:foreignPort)?(/us-port-:localPort)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-port-:foreignPort)?(/foreign-country-:country)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-country-:country)?(/us-port-:localPort)?(/foreign-port-:foreignPort)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/us-port-:port)?(/foreign-country-:country)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-port-:foreignPort)?(/us-port-:usPort)?(/foreign-country-:country)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/us-port-:usPort)?(/foreign-country-:country)?(/foreign-port-:foreignPort)?.aspx', "$usCodMapper"],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/month-:monthYear)?(/lp-:localPort-report)?.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/fc-:county)?(/fp-:port)?(/hscode-:hscode)?(/lp-:localPort-report)?.aspx', '/p/{hsCodeOrKeyword}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{country}/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/hscode-:hscode)?(/month-:monthYear)?(/lp-:localPort-report)?.aspx', '/p/{hsCodeOrKeyword}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/fc-:countryWODefault)?(/hscode-:hscode)?(/month-:monthYear)?(/lp-:localPort)?(/unit-:unit-report)?.aspx', '/p/{hsCodeOrKeyword}/{expImp}/{importInOrExportTo}-india/{secondCountryPrefix}-{countryWODefault}/'],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-port-:port)?(/foreign-country-:country)?(/us-port-:usPort)?.aspx', "$usCodMapper"],
    ['/shipment-data/:coo-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data)-of-port-(:portName)-(:portCode)(-:fromTo(to|from))?(-:cod)?',
        ({ params }) => {
            const { tabName, portName, portCode, coo, cod } = params;
            const portCountry = Object.entries(tradePorts).find(([, details]) => details[0] === portCode)?.[1][1] || '';
            if (portCountry) {
                const expImpType = expImpTypeMap[tabName] || "export-import";
                const tabText = tabwiseText[tabName] || "search";
                const portPrefix = portPrefixMap[tabName] || "";
                return `/global-trade-data/${portCountry.toLowerCase().replace(/ /g, '-')}-${expImpType}-trade-data/${tabText}/${portPrefix}port-${portName}-${portCode}${coo && coo != 'global' ? `/coo-${coo}` : ''}${cod ? `/cod-${cod}` : ''}/`;
            }
            else {
                return `/ports/india-ports/`;
            }
        }
    ],
    ['/shipment-data/:COO-:expImp(import|export)-data(.aspx)?', '/global-trade-data/{COO}-{expImp}-trade-data/'],
    ['/shipment-data/:coo-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data)(-:fromTo(to|from)-:cod)?',
        ({ params }) => {
            const { tabName, coo, cod } = params;
            const isBuyerTab = tabName == "importers-buyers",
                isImportTab = tabName == "import-data";
            const expImpKey = expImpTypeMap[tabName] || "export-import",
                tabLabel = tabwiseText[tabName] || "search";
            return `/global-trade-data/${coo}-${expImpKey}-trade-data/${tabLabel}${cod ? `/${isBuyerTab || isImportTab ? 'coo' : 'cod'}-${cod}` : ''}/`;
        }
    ],
    ['/shipment-data/:coo-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data)-of-(:keyword)(-and-hscode-(:hsKeyword))?(-:fromTo(to|from)-:cod)?', ({ params }) => {
        const { tabName } = params;
        let { coo, cod, keyword, hsKeyword } = params;
        coo = coo?.replace(/ /g, '-');
        cod = cod?.replace(/ /g, '-');
        if (regexOfKeywordAndHSN.test(keyword)) {
            const regexValues = keyword.match(regexOfKeywordAndHSN);
            if (regexValues?.groups) {
                const { product, hsn } = regexValues.groups;
                if (product) {
                    keyword = product;
                }
                if (hsn) {
                    hsKeyword = hsn;
                }
            }
        }
        const matchedCountryPattern = coo.match(/^shipment-data-(.*)$/);
        if (matchedCountryPattern) {
            coo = matchedCountryPattern[1];
        }
        if (coo) {
            coo = util.getCountryFilterMapping(coo);
        }
        if (cod) {
            cod = util.getCountryFilterMapping(cod);
        }
        if (invalidCountries.indexOf(coo) > -1) {
            coo = '';
        }
        let hsCode = '';
        keyword = keyword.replace(/ /g, '-');
        if (keyword.startsWith('of-') || keyword.startsWith('of+')) {
            keyword = keyword.substr(3, keyword.length);//remove of- is coming at the start of keyword
        }
        if (hsnVariation.test(keyword)) {
            hsCode = keyword.replace(hsnVariation, '$1');
            keyword = '';
        }
        else if (hsCodeKeywordRegex.test(keyword)) {
            hsCode = keyword.replace(hsCodeKeywordRegex, '$1');
            keyword = '';
        }
        else if (hsKeyword) {
            hsCode = hsKeyword;
        }
        else if (keyword && keyword.indexOf('hscode-') > -1) {
            hsCode = keyword.split('hscode-')[1];
        }
        else if (keyword && keyword.indexOf('+hscode') > -1) {
            hsCode = keyword.split('+hscode')[0];
        }
        else {
            hsCode = hsKeyword;
        }
        if (hsCode && !numericRegex.test(hsCode)) {
            hsCode = '';
        }
        if (coo && coo !== 'global' && !countryLookup.find(key => key === coo.replace(/-/g, ' ').toLowerCase())) {
            return 404;
        }

        const product = !hsCode && keyword ? keyword : keyword.indexOf('hscode') == -1 ? keyword : '';
        const showCooCountry = coo && coo != "global", isBuyerTab = tabName == "importers-buyers", isSupplierTab = tabName == "exporters-suppliers",
            isImportTab = tabName == "import-data", isExportTab = tabName == "export-data";
        let finalKeyword = product ? product.split('-').join("-or-").split("+").join("-").split('-and-').join('-').replace(/`s/g, '') : '';
        const finalHsKeyword = hsCode ? hsCode.split('-').join("-or-") : '';
        const cooFilterKey = isBuyerTab ? 'buyers-in' : isSupplierTab ? 'manufacturers-in' : isImportTab ? 'import-in' : isExportTab ? 'export-from' : 'coo',
            codFilterKey = (isBuyerTab || isImportTab) ? 'coo' : 'cod', tabText = isBuyerTab ? '/buyers' : isSupplierTab ? '/manufacturers' : isImportTab ? '/import' : isExportTab ? '/export' : '';
        if (util.removeSpecialCharacterSearch.includes(cod)) {
            return `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}${tabText}${showCooCountry ? `/${cooFilterKey}-${coo}` : ''}${finalHsKeyword && finalKeyword ? `/hsn-code-${finalHsKeyword}` : ''}/`;
        }
        else {
            if (tabText) {
                finalKeyword = /^\d+$/.test(finalKeyword) ? `hsn-code-${finalKeyword}` : finalKeyword;
                let urlToRedirects = `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}${tabText}/`;
                if (coo && showCooCountry) {
                    urlToRedirects += `${cooFilterKey}-${coo}/`;
                }
                if (finalHsKeyword && finalKeyword) {
                    urlToRedirects += `hsn-code-${finalHsKeyword}/`;
                }
                if (cod) {
                    urlToRedirects += `${codFilterKey}-${cod}/`;
                }
                return urlToRedirects;
            }
            else {
                return `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/hsn-code-${finalHsKeyword}` : ''}/`;
            }
        }
    }]
];
module.exports = {
    dynamicRedirections,
    util
}