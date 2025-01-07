import countryFilterMapping from './countryFilterMapping.js';
import tradePorts from './ports.js';
const regexToReplaceKeywords = /(_|-| )/g;
const regexKeywordDiffPattern = /\b(exports|imports)\b\s*[+-]\s*\b(in|from)\b\s*[-+]\s*\b([\w\s]+)\b/;//exports-from-india or exports+from+india
const regexForTopProductMultiCountry = /^\/?[a-zA-Z]+-to-[a-zA-Z]+$/;
const hsCodeWithOrKeyword = /^(\d{4,8})-or-hscode$/;
const hsCodeKeywordRegex = /^(\d{4,8})-hscode$/;
const urlMappings = {
    'exporters-importers-export-import': '/trade-data',
    'buyers': '/buyers',
    'suppliers': '/suppliers',
    'import': '/imports',
    'export': '/exports'
};

const util = {
    replacement: ({ params, rule }) => {
        const { to: pattern } = rule;
        const { keyword, hscode } = params;
        if (params.keyword) {
            params.keyword = hsCodeWithOrKeyword.test(params.keyword)
                ? `hsn-code-${keyword.replace(hsCodeWithOrKeyword, '$1')}`
                : util.cleanKeyword(params.keyword);
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
        params.hsCodeOrKeyword = hscode?.length >= 3 ? `hsn-code-${hscode}` : util.cleanKeyword(keyword);

        return pattern.replace(/\{(\w+)\}/g, (_, key) => params[key] || '');
    },
    usCodMapper({ params }) {
        const { expImp, country, keyword } = params;
        const buyerSupplier = expImp == "importers" ? "buyers" : "manufacturers";
        if (country && !util.removeSpecialCharacterSearch.includes(country)) {
            return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/coo-${util.parseCountryName(country)}/cod-united-states/`;
        }
        return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/cod-united-states/`;
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
    parseCountryName(country, returnDefault) {
        if ((!country || country === 'n/a')) {
            return returnDefault ? 'global' : '';
        }
        if (country === 'korea') return 'north-korea';
        country = country.replace(/_/g, ' ');
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
    changeGlobalSearchURLFromOldToNew: (url) => {
        for (const [key, path] of Object.entries(urlMappings)) {
            if (url.includes(key)) {
                return path;
            }
        }
        return '/trade-data';
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

export {
    util
}

export default [
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
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/${expImp === 'export' ? 'export-from' : 'import-in'}-india/` + (hsCode.length >= 4 ? `hsn-code-${hsCode}/` : '');
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fc-:country/:port-report.aspx',
        ({ params }) => {
            const { keyword, expImp } = params;
            const isImport = expImp == "import";
            const country = util.parseCountryName(params.country, true);
            if (keyword.indexOf("hscode") > -1 && (params.port && params.port.indexOf("hscode") > -1)) {
                return `/p/hsn-code-${params.port.split('-').length > 1 ? params.port.split('-')[1] : params.port.split('-')[0]}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${isImport ? 'coo' : 'cod'}-${country}/`;
            }
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${isImport ? 'coo' : 'cod'}-${country}/`;
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
            const { expImp } = params;
            const isImport = expImp == "import";
            const country = util.parseCountryName(params.country)
            const keyword = util.cleanKeyword(params.keyword);
            if (keyword.indexOf('hscode') === -1 && keyword.length >= 3) {
                return `/p/${keyword}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${country ? `${isImport ? 'coo' : 'cod'}-${country}/` : ''}`;
            }
            return `/p/hsn-code-${params.hsCode.length >= 3 ? params.hsCode : params.keyword.split('-')[0]}/${expImp}/${isImport ? 'import-in' : 'export-from'}-india/${country ? `${isImport ? 'coo' : 'cod'}-${country}/` : ''}`;
        }
    ],
    ['/indian-:importerExporter(importers|exporters)/:keyword-:importerExporter2(importers|exporters).aspx',
        ({ params }) => `/p/${util.cleanKeyword(params.keyword)}/${params.importerExporter === 'importers' ? 'buyers' : 'manufacturers'}/${params.importerExporter === 'importers' ? 'buyers' : 'manufacturers'}-in-india/`
    ],
    ['/us-import-data/:keyword-import-data.aspx', '/p/{keyword}/import/import-in-united-states/'],
    ['/us-import-data/foreign-port-:fp-export-to-us.aspx',
        ({ params }) => `/p/${util.cleanKeyword(params.fp).replace(regexToReplaceKeywords, '-or-')}/buyers/import-in-united-states/`
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
    ['/us-import-data/foreign-port-:fp-export-to-us/us-port-:portName/foreign-country-:fc.aspx', '/top-products/top-export-products-from-{fc}-to-united-states/'],
    ['/us-import-data/us-port-:keyword-united-states-import.aspx', '/p/{keyword}/import/'],
    ['/us-import-data/:keyword-import/:portType(us-port|foreign-port|foreign-country)-:portCountryName.aspx',
        ({ params }) => {
            const { portType, keyword, portCountryName } = params;
            return `/p/${util.cleanKeyword(keyword)}/import/import-in-united-states/${portType === 'foreign-country' ? `coo-${util.parseCountryName(portCountryName)}/` : ''}`;
        }
    ],
    ['/us-importers/:keyword-importers.aspx', '/p/{keyword}/buyers/buyers-in-united-states/'],
    ['/us-importers/:keyword-importers/:countryPortType(foreign-country|us-port|foreign-port)-:countryPortName.aspx',
        ({ params }) => {
            const { keyword, countryPortType, countryPortName } = params;
            if (countryPortType === 'foreign-country') {
                return `/p/${util.cleanKeyword(keyword)}/buyers/buyers-in-united-states/coo-${util.parseCountryName(countryPortName)}/`;
            }
            return `/p/${util.cleanKeyword(keyword)}/buyers/buyers-in-united-states/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expoImpo(import|export)/fc-:title/lp-:name-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expoImpo(import|export)/fp-:title/hscode-:code-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/india-:expImp(import|export)-data/:keyword-:expoImpo(import|export)/hscode-:hsCode/lp-:name-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/{importInOrExportTo}-india/'],
    ['/us-import-data/:keyword-import/foreign-country-:COD.aspx', '/p/{keyword}/buyers/buyers-in-{COD}/coo-united-states/'],
    ['/exporter-to-us/:keyword-exporter-export-to-us/:portType(us-port|foreign-port|foreign-country)-:portCountryName.aspx',
        ({ params }) => {
            const { portType, keyword, portCountryName } = params;
            let country = 'global';
            if (portType === 'foreign-country') {
                country = util.parseCountryName(portCountryName);
            }
            if (util.removeSpecialCharacterSearch.includes(country)) {
                return `/p/${util.cleanKeyword(keyword)}/manufacturers/cod-united-states/`;
            }
            return `/p/${util.cleanKeyword(keyword)}/manufacturers/manufacturers-in-${country}/cod-united-states/`;
        }
    ],
    ['/exporter-to-us/:keyword-exporter-export-to-us.aspx', '/p/{keyword}/manufacturers/cod-united-states/'],
    ['/india-trading-partners/:country-:expImp(imports|exports).aspx',
        ({ params }) => {
            const country = util.parseCountryName(params.country, true);
            const [from, to] = (params.expImp === 'imports') ? ["india", country] : [country, "india"];
            return `/top-products/top-${params.expImp === 'imports' ? 'import' : 'export'}-products-from-${from}-to-${to}/`;
        }
    ],
    ['/:country-:expImp(import|export)s-trade-data.aspx', '/global-trade-data/{country}-{expImp}-trade-data/'],
    ['/(:country)_(:keyword)_:expImp(import|export)ers.aspx',
        ({ params }) => {
            const { expImp, keyword, country } = params;
            const buyerSupplier = expImp === 'import' ? 'buyers' : 'manufacturers';
            return `/p/${util.cleanKeyword(keyword)}/${buyerSupplier}/${buyerSupplier}-in-${util.parseCountryName(country, true)}/`;
        }
    ],
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
    ['/exim/indian-customs/(:portName)_customs:icd(_icd|_air|_sea|_ppg)?_:expImp(export|import)_data.aspx', "$indianCustomsPortData"],
    ['/indian-customs/(:portName)-customs-:expImp(export|import)-data.aspx', "$indianCustomsPortData"],
    ['/global-export-import-data-:keyword', '/p/{keyword}/'],
    ['/:countryFilterMap-:expImp(import|export)-data-:keyword', '/p/{keyword}/{expImp}/{importInOrExportTo}-{countryFilterMap}/'],
    ['/(:countryFilterMap)_:expImp(import|export)_trade_data.aspx', '/global-trade-data/{countryFilterMap}-{expImp}-trade-data/'],
    ['/topexportimportproducts/:expImp(import|export).aspx',
        ({ params }) => {
            const { expImp } = params;
            return `/top-products/top-${expImp}-products-${expImp.toLowerCase() === 'import' ? 'of' : 'from'}-india/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:product-(export|import)/fc-:country/hscode-:code/lp-:port/unit-:unitType-report.aspx',
        ({ params }) => {
            const { expImp } = params;
            const country = util.parseCountryName(params.country);
            const product = util.cleanKeyword(params.product);
            const isImport = expImp === 'import';
            if (product.length >= 3) {
                return `/p/${product}/${expImp}/coo-india/cod-${country}/`;
            }
            if (params.code && params.code.length >= 3) {
                return `/p/hsn-code-${params.code}/${expImp}/coo-india/cod-${country}/`;
            }
            if (params.country) {
                return `/top-products/top-${expImp}-products-from-india-to-${country}/`;
            }
            return `/top-products/top-${expImp}-products-${isImport ? 'of' : 'from'}-india/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-export/unit-:unit-report.aspx', '/p/{keyword}/{expImp}/coo-india/'],
    ['/india-:expImp(import|export)-data/:hsCode-hscode-:expImp(import|export)/:date/:port-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/'],
    ['/shipment-data/:country/lp-:port-:expImp(import|export)-data-of-:product', '/p/{product}/{expImp}/coo-{country}/'],
    ['/shipment-data/india-exporters-suppliers-of-hscode-:hsCode-to-:COD/lp-:port', '/p/hsn-code-{hsCode}/manufacturers/manufacturers-in-india/cod-{COD}/'],
    ['/us-:expImp(import|export)-data/:product-(import|export)/foreign-country-:country/us-port-:lport/foreign-port-:fport.aspx', '/p/{product}/{expImp}/coo-united-states/cod-{country}/'],
    ['/us-:expImp(import|export)-data/:product-(import|export)/us-port-:lport/foreign-country-:country/foreign-port-:fport.aspx', '/p/{product}/{expImp}/coo-united-states/cod-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/us-port-:lport/foreign-port-:fport.aspx', '/p/{keyword}/{expImp}/coo-united-states/'],
    ['/us-:expImp(import|export)-data/:product-(import|export)/us-port-:lport/foreign-country-:country.aspx', '/p/{product}/{expImp}/coo-united-states/cod-{country}/'],
    ['/us-:expImp(import|export)-data/:product-(import|export)(/us-port-:lport)?/foreign-country-:country/foreign-port-:fport.aspx', '/p/{product}/{expImp}/coo-united-states/cod-{country}/'],
    ['/us-:expImp(import|export)-data/:product-(import|export)(/us-port-:lport)?/foreign-port-:fport/foreign-country-:country.aspx', '/p/{product}/{expImp}/coo-united-states/cod-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)(/foreign-country-:country)?/foreign-port-:fport/us-port-:lport.aspx', '$usImpExpMapper'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)/foreign-port-:fport/us-port-:lport/foreign-country-:country.aspx', '/p/{keyword}/{expImp}/{importInOrExportTo}-united-states/{secondCountryPrefix}-{country}/'],
    ['/us-:expImp(import|export)-data/:keyword-(import|export)(/foreign-port-:fport)?/foreign-country-:country/us-port-:lport.aspx', '$usImpExpMapper'],
    ['/us-importers/:keyword-importers/foreign-country-:COO?(/foreign-port-:fp)?(/us-port-:lp)?.aspx', '/p/{keyword}/buyers/buyers-in-united-states/coo-{COO}/'],
    ['/us-importers/:keyword-importers/foreign-port-:fp/us-port-:lp/foreign-country-not-available.aspx', '/p/{keyword}/buyers/buyers-in-united-states/'],
    ['/us-importers/:product-importers/foreign-port-:fp?(/foreign-country-:fc)?(/us-port-:lp)?.aspx',
        ({ params }) => {
            const { fc, product } = params;
            const cleanCountry = util.getCountryFilterMapping(fc);
            if (cleanCountry && !util.removeSpecialCharacterSearch.includes(fc)) {
                return `/p/${util.cleanKeyword(product)}/buyers/buyers-in-united-states/coo-${cleanCountry}/`;
            }
            return `/p/${util.cleanKeyword(product)}/buyers/buyers-in-united-states/`;
        }
    ],
    ['/exporter-to-us/:product-exporter-export-to-us/foreign-port-:fp?(/us-port-:lp)?(/foreign-country-:fc)?(/us-port-:lp2)?.aspx', "$usManufacturerCodMapper"],
    ['/exporter-to-us/:product-(exporter-)?export-to-us/us-port-:lp/foreign-port-:fp?(/foreign-country-:fc)?.aspx', "$usManufacturerCodMapper"],
    ['/exporter-to-us/:product-exporter-export-to-us(/us-port-:lp)?/foreign-country-:fc?(/foreign-port-:fp)?(/us-port-:lp2)?(/foreign-port-:fp2)?.aspx', "$usManufacturerCodMapper"],
    ['/companies/saranya-foods-exports--------79-386742.aspx', '/companies/saranya-foods-exports-79-386742.aspx'],
    ['/companies/sada-impex-------------------241-386805.aspx', '/companies/sada-impex-241-386805.aspx'],
    ['/companies/richmont-goods--services-pvt-ltd-369890.aspx', '/companies/richmont-goods-services-pvt-ltd-369890.aspx'],
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
            if (isNaN(Number(data)) && data.indexOf('hscode') === -1) {
                return `/p/${util.cleanKeyword(data)}/${impExp}/coo-india/cod-${countryName}/`;
            }
            return `/p/${data.indexOf('-hscode') > -1 ? 'hsn-code-' + data.split('-')[0] : `hsn-code-${hsCode}`}/${impExp}/coo-india/cod-${countryName}/`;
        }
    ],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/fp-:foriegnPort/hscode-:hsCode/unit-:unit-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/'],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/hscode-:hsCode/month-:monthYear/lp-:port-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/'],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/fc-:COD/hscode-:hsCode/month-:monthYear-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/cod-{COD}/'],
    ['/india-:expImp(export|import)-data/:hsCode-hscode-:expImp2(export|import)/fp-:forignPort/hscode-:hs2/lp-:port-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/'],
    ['/india-:expImp(export|import)-data/:hsCode-hscode-:expImp2(export|import)/fc-:COD/hscode-:hs2/unit-:unit-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/cod-{COD}/'],
    ['/india-:expImp(export|import)-data/:hs-hscode-:expImp2(export|import)/fc-:COD/fp-:foreignPort/hscode-:hsCode/lp-:port/unit-:unit-report.aspx', '/p/hsn-code-{hsCode}/{expImp}/coo-india/cod-{COD}/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fp-:foreignPort/lp-:port-report.aspx', '/p/{keyword}/{expImp}/coo-india/'],
    ['/india-:impExp(export|import)-data/:keyword-:expImp2(export|import)/fc-:country/hscode-:hscode/month-:monthYear-report.aspx',
        ({ params }) => {
            const { impExp, country, hscode } = params;
            const keyword = util.cleanKeyword(params.keyword);
            return keyword.length >= 3 ? `/p/${keyword}/${impExp}/coo-india/cod-${util.parseCountryName(country)}/` : `/p/hsn-code-${hscode}/${impExp}/coo-india/cod-${util.parseCountryName(country)}/`;
        }
    ],
    ['/india-:expImp(import|export)-data/:keyword-:expImp2(import|export)/fp-:portName([a-zA-Z_/-]{1,40})-report.aspx', '/p/{keyword}/{expImp}/coo-india/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fp-:foreignPort/hscode-:hscode-report.aspx',
        ({ params }) => {
            const { expImp, hscode, keyword } = params;
            if (hscode.length >= 4) {
                return `/p/${util.cleanKeyword(keyword)}/coo-india/hsn-code-${hscode}/`;
            }
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/coo-india/`;
        }
    ],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fc-:COD/month-:monthYear/lp-:port-report.aspx', '/p/{keyword}/{expImp}/coo-india/cod-{COD}/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/fc-:country)?(/fp-:foreignPort)?(/hscode-:hscode)?(/lp-:localPort)?(/month-:monthYear)?(/unit-:unit-report)?.aspx',
        ({ params }) => {
            const { expImp, country, hscode } = params;
            let keyword = util.cleanKeyword(params.keyword);
            if (hscode && hscode.length >= 4 && (country && country == "others" || !country)) {
                if (isNaN(Number(keyword)) && keyword.length > 2) {
                    return `/p/${keyword}/${expImp}/coo-india/hsn-code-${hscode}/`;
                }
                return `/p/hsn-code-${hscode}/${expImp}/coo-india/`;
            }
            if (country && country != "others") {
                return expImp === "export" ? `/p/${keyword}/${expImp}/coo-india/cod-${util.parseCountryName(country)}/` : `/p/${keyword}/${expImp}/import-in-${util.parseCountryName(country)}/coo-india/`;
            }
            return `/p/${keyword}/${expImp}/coo-india/`;
        }
    ],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)/fc-:COD/month-:monthYear/lp-:localPort/unit-:unit-report.aspx', '/p/{keyword}/{expImp}/coo-india/cod-{COD}/'],
    ['/india-:expImp(import|export)-data/:keyword-import/hscode-:hscode/month-:monthYear/lp-:port-report.aspx',
        ({ params }) => {
            const { expImp, hscode, keyword } = params;
            return `/p/${util.cleanKeyword(keyword)}/${expImp}/coo-india/` + (hscode?.length >= 4 ? `hsn-code-${hscode}/` : '');
        }
    ],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/foreign-port-:foreginPort)?(/us-port-:usPort)?(/foreign-country-:country)?.aspx', "$usCooMapper"],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/us-port-:usPort)?(/foreign-port-:foreginPort)?(/foreign-country-:country)?.aspx', "$usCooMapper"],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/us-port-:usPort)?(/foreign-country-:country)?(/foreign-port-:foreginPort)?.aspx', "$usCooMapper"],
    ['/us-:expImp(importers|exporters)?(/:keyword-:expImp2(importers|exporters))?(/foreign-country-:country)?(/us-port-:usPort)?(/foreign-port-:foreginPort)?.aspx', "$usCooMapper"],
    ['/export-import-products/:keyword.aspx', '/export-import-products/{keyword}-01/'],
    ['/:expImp(exporter|importer)-to-us/?(:keyword-export-to-us)?(/foreign-country-:country)?(/us-port-:port)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-country-:country)?(/foreign-port-:foreignPort)?(/us-port-:localPort)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-port-:foreignPort)?(/foreign-country-:country)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-country-:country)?(/us-port-:localPort)?(/foreign-port-:foreignPort)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/us-port-:port)?(/foreign-country-:country)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-port-:foreignPort)?(/us-port-:usPort)?(/foreign-country-:country)?.aspx', "$usCodMapper"],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/us-port-:usPort)?(/foreign-country-:country)?(/foreign-port-:foreignPort)?.aspx', "$usCodMapper"],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/month-:monthYear)?(/lp-:localPort-report)?.aspx', '/p/{keyword}/{expImp}/coo-india/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/fc-:county)?(/fp-:port)?(/hscode-:hscode)?(/lp-:localPort-report)?.aspx', '/p/{hsCodeOrKeyword}/{expImp}/coo-india/cod-{country}/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/hscode-:hscode)?(/month-:monthYear)?(/lp-:localPort-report)?.aspx', '/p/{hsCodeOrKeyword}/{expImp}/coo-india/'],
    ['/india-:expImp(export|import)-data/:keyword-:expImp2(export|import)?(/fc-:country)?(/hscode-:hscode)?(/month-:monthYear)?(/lp-:localPort)?(/unit-:unit-report)?.aspx', '/p/{hsCodeOrKeyword}/{expImp}/coo-india/cod-{country}/'],
    ['/:expImp(exporter|importer)-to-us/:keyword-:expImp2(export|import)-to-us?(/foreign-port-:port)?(/foreign-country-:country)?(/us-port-:usPort)?.aspx', "$usCodMapper"],
    ['/companies/:companyName:dash([-]{2,20}):name2-:id.aspx', '/companies/{companyName}-{name2}-{id}.aspx'],
    ['/countries', '/global-trade-data/country-list/'],
    ['/:countryWODefault-:expImp(export|import)-data', '/global-trade-data/{countryWODefault}-{expImp}-trade-data/'],
    ['/:country-:expImp(export|import)-rare-data', '/global-trade-data/{country}-{expImp}-trade-data/'],
    ['/products/default', '/export-import-products/a-01/'],
    ['/products/:keyword([a-zA-Z])([0-9]){1,3}', '/export-import-products/{keyword}-01/'],
    ['/global-products:subfolder(*)', '/export-import-products{subfolder}/'],
    ['/shipment-data/:countryName-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data):restUrl(*)',
        ({ params }) => {
            const { countryName, tabName, restUrl } = params;
            const urlPrefix = util.changeGlobalSearchURLFromOldToNew(tabName);
            const urlToRedirect = `${urlPrefix}-${countryName}/${countryName}-${tabName}${restUrl}`;
            if (urlToRedirect.match(/^\/(?:(trade-data|suppliers|imports|exports))-(?:([^\/]+?))\/(?:([^\/]+?))-(?:(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data))-of-((?:([^\/]+?)))(-and-hscode-((?:([^\/]+?))))?(-(?:(to|from))-(?:([^\/]+?)))?\/?$/i) != null) {
                const finalValue = restUrl.split("-to-");
                const keyword = finalValue[0].replace("-of-", "");
                const country = finalValue[1];
                return `/p/${util.cleanKeyword(keyword)}/manufacturers/cod-${country}/`;
            }
            if (urlToRedirect.match(/^\/(?:(trade-data|buyers|imports|exports))-(?:([^\/]+?))\/(?:([^\/]+?))-(?:(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data))-of-((?:([^\/]+?)))(-and-hscode-((?:([^\/]+?))))?(-(?:(to|from))-(?:([^\/]+?)))?\/?$/i) != null) {
                const finalValue = restUrl.split("-of-");
                let keyword = finalValue[1].replace(/\+/g, '-');
                if (keyword.indexOf('-and-') > -1) {
                    keyword = keyword.replace(/-and-/g, '-');
                }
                keyword = keyword.split("-from-");
                keyword = keyword[0];
                return `/p/${util.cleanKeyword(keyword)}/buyers/buyers-in-${countryName}/`;
            }

            return `${urlPrefix}-${countryName}/${countryName}-${tabName}${restUrl}`;
        }
    ],
    ['/product/:keyword-global-export-import-trade-data.php', '/p/{keyword}/'],
    ['/product/:countryName-:expImp(export|import)-trade-data-:product.php', '/p/{product}/{expImp}/{importInOrExportTo}-{countryName}/'],
    ['/product/:keyword.php', '/p/{keyword}/'],
    ['/search/:product-:expImp(export|import)-data-:country.php', '/p/{product}/{expImp}/{importInOrExportTo}-{country}/'],
    ['/search/:keyword.php', '/p/{keyword}/'],
    ['/:urlPrefix(trade-data|buyers|suppliers|imports|exports)-:coo/:coo2-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data)-of-port-(:portName)-(:portCode)(-:fromTo(to|from))?(-:cod)?',
        ({ params }) => {
            const { tabName, portName, portCode, coo, cod } = params;
            const portCountry = Object.entries(tradePorts).find(([, details]) => details[0] === portCode)?.[1][1] || 'global';
            const isBuyerTab = tabName == "importers-buyers", isSupplierTab = tabName == "exporters-suppliers",
                isImportTab = tabName == "import-data", isExportTab = tabName == "export-data";
            const expImpType = (isBuyerTab || isImportTab) ? "import" : (isSupplierTab || isExportTab) ? "export" : "export-import";
            const tabText = isBuyerTab ? "buyers" : isSupplierTab ? "manufacturers" : isImportTab ? "imports" : isExportTab ? "exports" : "search";
            const portPrefix = (isBuyerTab || isImportTab) ? "pod-" : (isSupplierTab || isExportTab) ? "poo-" : "";
            return `/global-trade-data/${portCountry.toLowerCase()}-${expImpType}-trade-data/${tabText}/${portPrefix}port-${portName}-${portCode}${coo && coo != 'global' ? `/coo-${coo}` : ''}${cod ? `/cod-${cod}` : ''}/`;
        }
    ],
    ['/:urlPrefix(trade-data|buyers|suppliers|imports|exports)-:coo/:coo2-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data)(-:fromTo(to|from)-:cod)?',
        ({ params }) => {
            const { tabName, coo, cod } = params;
            const isBuyerTab = tabName == "importers-buyers", isSupplierTab = tabName == "exporters-suppliers",
                isImportTab = tabName == "import-data", isExportTab = tabName == "export-data";
            const expImpKey = (isBuyerTab || isImportTab) ? 'import' : (isSupplierTab || isExportTab) ? 'export' : 'export-import',
                tabLabel = isBuyerTab ? "buyers" : isSupplierTab ? "manufacturers" : isImportTab ? 'imports' : isExportTab ? "exports" : "search";
            return `/global-trade-data/${coo}-${expImpKey}-trade-data/${tabLabel}${cod ? `/${isBuyerTab || isImportTab ? 'coo' : 'cod'}-${cod}` : ''}/`;
        }
    ],
    ['/:urlPrefix(trade-data|buyers|suppliers|imports|exports)-:coo2/:coo-:tabName(exporters-importers-export-import-data|importers-buyers|exporters-suppliers|import-data|export-data)-of-(:keyword)(-and-hscode-(:hsKeyword))?(-:fromTo(to|from)-:cod)?',
        ({ params }) => {
            const { tabName, keyword, hsKeyword } = params;
            let { coo, cod } = params;
            let urlToRedirects;
            let replaceChars = { "-or-": "", "and": "", 'of ': '' };
            let hsCode = '';
            if (hsKeyword) {
                hsCode = hsKeyword;
            } else if (keyword && keyword.indexOf('hscode-') > -1) {
                hsCode = keyword.split('hscode-')[1];
            } else if (keyword && keyword.indexOf('-hscode') > -1) {
                hsCode = keyword.split('-hscode')[0];
            } else if (keyword && keyword.indexOf('+hscode') > -1) {
                hsCode = keyword.split('+hscode')[0];
            } else {
                hsCode = hsKeyword;
            }
            const product = !hsCode && keyword ? keyword : keyword.indexOf('hscode') == -1 ? keyword : '';
            let showCooCountry = coo && coo !== "global", isBuyerTab = tabName === "importers-buyers", isSupplierTab = tabName === "exporters-suppliers",
                isImportTab = tabName === "import-data", isExportTab = tabName === "export-data";
            let finalKeyword = product ? product.split('-').join("-or-").split("+").filter(a => a !== 'and').join("-") : '';
            let finalHsKeyword = hsCode ? hsCode.split('-')[0] : '';
            finalKeyword = finalKeyword.replace('of ', '');
            const matchFound = regexKeywordDiffPattern.exec(finalKeyword);
            if (matchFound && finalHsKeyword) {
                finalKeyword = '';
                const [fullMatch, exportsImports, inFrom, country] = matchFound;
                if (exportsImports === 'exports') {
                    isExportTab = true;
                } else {
                    isImportTab = true;
                }
            }
            const cooFilterKey = isBuyerTab ? 'buyers-in' : isSupplierTab ? 'manufacturers-in' : isImportTab ? 'import-in' : isExportTab ? 'export-from' : 'coo',
                codFilterKey = (isBuyerTab || isImportTab) ? 'coo' : 'cod', tabText = isBuyerTab ? '/buyers' : isSupplierTab ? '/manufacturers' : isImportTab ? '/import' : isExportTab ? '/export' : '';
            if (finalKeyword.startsWith("of")) {
                finalKeyword = finalKeyword.replace('of', '');
            }
            if (coo && coo == "shipment-data-global") {
                showCooCountry = false
            }
            if (finalKeyword.endsWith('and') || finalKeyword.startsWith('-or-')) {
                finalKeyword = finalKeyword.replace((new RegExp('-or-|and', "g")), function (match) { return replaceChars[match] })
            }
            if (finalKeyword && finalHsKeyword) {
                finalKeyword = finalKeyword.split("and")[0] && finalKeyword.split(" and ")[0];
            }
            finalKeyword = util.cleanKeyword(finalKeyword);
            finalHsKeyword = finalHsKeyword.replace(/[^a-zA-Z0-9/]/g, '');
            if (coo) {
                coo = util.parseCountryName(coo);
                coo = util.cleanKeyword(coo);
            }
            if (cod) {
                cod = util.cleanKeyword(cod);
                cod = util.parseCountryName(cod);
            }
            if (util.removeSpecialCharacterSearch.includes(cod)) {
                urlToRedirects = `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}${tabText}${showCooCountry ? `/${cooFilterKey}-${coo}` : ''}${finalHsKeyword && finalKeyword ? `/hsn-code-${finalHsKeyword}` : ''}/`;
                if (urlToRedirects.match(/^\/p(?:\/([^\/]+?))?(?:(\/export))?\/(?:(coo|cod))-(?:([^\/]+?))\/?$/i) != null) {
                    const NewUrl = urlToRedirects.split("/");
                    const keyword1 = NewUrl[2];
                    const filterApply = NewUrl[3].split('-');
                    const country1 = filterApply[1];
                    return `/p/${keyword1}/export/export-from-${country1}/`;
                }
            } else if (util.removeSpecialCharacterSearch.includes(finalKeyword)) {
                urlToRedirects = `/p${finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${tabText}${showCooCountry ? `/${cooFilterKey}-${coo}` : ''}${cod ? `/${codFilterKey}-${cod}` : ''}/`;
            } else if (util.removeSpecialCharacterSearch.includes(coo)) {
                urlToRedirects = `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}${tabText}${finalHsKeyword && finalKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${cod ? `/${codFilterKey}-${cod}` : ''}/`;

            } else {
                if (tabName === 'exporters-importers-export-import-data' && coo && cod) {
                    //added condition for ticket #49362
                    urlToRedirects = `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}/import/import-in-${coo}/coo-${cod}/`;
                } else {
                    urlToRedirects = `/p${finalKeyword && !finalHsKeyword ? `/${finalKeyword}` : ''}${!finalKeyword && finalHsKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${finalHsKeyword && finalKeyword ? `/${finalKeyword}` : ''}${tabText}${showCooCountry ? `/${cooFilterKey}-${coo}` : ''}${finalHsKeyword && finalKeyword ? `/hsn-code-${finalHsKeyword}` : ''}${cod ? `/${codFilterKey}-${cod}` : ''}/`;
                }
            }
            return urlToRedirects.replace('-shipment-data-', '-');
        }
    ],
    ['/p/:hsCode-hscode/coo-:COO/cod-:COD/', '/p/hsn-code-{hsCode}/export/export-from-{COO}/cod-{COD}/'],
    ['/p/:hs-hscode/coo-:COO/hsn-code-:hsCode/', '/p/hsn-code-{hsCode}/export/export-from-{COO}/'],
    ['/p/:keyword1/:keyword2/buyers/:COOCOD(coo|cod)-:countryX/', '/p/{keyword1}-{keyword2}/buyers/{COOCOD}-{countryX}/'],   /* countryX so that no clean-up is performed */
    ['/p/of-:keyword/manufacturers/:COOCOD(coo|cod)-shipment-data-global/', '/p/{keyword}/manufacturers/'],
    ['/p/:keyword1/:COOCOD(coo|cod)-:country1/export-from-:country2/',
        ({ params }) => {
            const { keyword1, country1, country2 } = params;
            const country2Clean = util.parseCountryName(country2);
            if (util.removeSpecialCharacterSearch.includes(country1)) {
                return `/p/${util.cleanKeyword(keyword1)}/export/export-from-${country2Clean}/`;
            }
            return `/p/${util.cleanKeyword(keyword1)}/export/export-from-${country2Clean}/cod-${util.parseCountryName(country1)}/`;
        }
    ],
    ['/p/:keyword/import-in-:COD/:COOCOD(coo|cod)-:COO/', '/p/{keyword}/import/import-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/import/import-in-:COD/cod-:COO/', '/p/{keyword}/import/import-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/import/hsn-code-:hsCode/coo-:COO/import-in-:COD/', '/p/{keyword}/import/import-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/import/hsn-code-:hsCode/import-in-:COD/coo-:COO/', '/p/{keyword}/import/import-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword1/import/:COOCOD(coo|cod)-:country1/:COOCOD2(coo|cod)-:country2/',
        ({ params }) => {
            const { keyword1, COOCOD, country1, country2 } = params;
            const coo = COOCOD === 'cod' ? country2 : country1,
                cod = COOCOD === 'cod' ? country1 : country2;
            return `/p/${util.cleanKeyword(keyword1)}/import/import-in-${util.parseCountryName(cod)}/coo-${util.parseCountryName(coo)}/`;
        }
    ],
    ['/p/:keyword/import/import-in-:notavailablekey(not-available|not available|not_available)/:COOCOD(coo|cod)-:COO/', '/p/{keyword}/import/coo-{COO}/'],
    ['/p/:keyword/import/import-in-:COD/:COOCOD(coo|cod)-:notavailablekey(not-available|not available|not_available)/', '/p/{keyword}/import/import-in-{COD}/'],
    ['/p/:keyword/import/coo-:COO/import-in-:COD/', '/p/{keyword}/import/import-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/import/coo-:COO/hsn-code-:hsCode/import-in-:COD/', '/p/{keyword}/import/import-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/export/cod-:COD/:sub(coo|export-from)-:COO/', '/p/{keyword}/export/export-from-{COO}/cod-{COD}/'],
    ['/p/:keyword/export/coo-:COO/cod-:COD/', '/p/{keyword}/export/export-from-{COO}/cod-{COD}/'],
    ['/p/:keyword/export/export-from-:COO/coo-:COD/', '/p/{keyword}/export/export-from-{COO}/cod-{COD}/'],
    ['/p/:keyword/export-from-:COO/', '/p/{keyword}/export/export-from-{COO}/'],
    ['/p/:keyword/export-from-:COO/coo-:COD/', '/p/{keyword}/export/export-from-{COO}/cod-{COD}/'],
    ['/p/:keyword/export/cod-:COD/hsn-code-:hsCode/', '/p/{keyword}/export/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/export/hsn-code-:hsCode/cod-:COD/export-from-:COO/', '/p/{keyword}/export/export-from-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/export/hsn-code-:hsCode/export-from-:COO/cod-:COD/', '/p/{keyword}/export/export-from-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/export/cod-:COD/hsn-code-:hsCode/export-from-:COO/', '/p/{keyword}/export/export-from-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/buyers/cod-:COD/coo-:COO/', '/p/{keyword}/buyers/buyers-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/buyers/coo-:COO/:sub(cod|buyers-in)-:COD/', '/p/{keyword}/buyers/buyers-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/buyers/buyers-in-:COD/cod-:COO/', '/p/{keyword}/buyers/buyers-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/buyers/coo-:COO/hsn-code-:hsCode/', '/p/{keyword}/buyers/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/buyers/hsn-code-:hsCode/coo-:COO/buyers-in-:COD/', '/p/{keyword}/buyers/buyers-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/buyers/hsn-code-:hsCode/buyers-in-:COD/coo-:COO/', '/p/{keyword}/buyers/buyers-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/buyers/coo-:COO/hsn-code-:hsCode/buyers-in-:COD/', '/p/{keyword}/buyers/buyers-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/manufacturers/coo-:COO/', '/p/{keyword}/manufacturers/cod-{COO}/'],
    ['/p/:keyword/manufacturers/cod-:COD/:sub(coo|manufacturers-in)-:COO/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/coo-:COO/cod-:COD/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/manufacturers-in-:COO/coo-:COD/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/cod-:COD/hsn-code-:hsCode/', '/p/{keyword}/manufacturers/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/hsn-code-:hsCode/cod-:COD/manufacturers-in-:COO/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/hsn-code-:hsCode/manufacturers-in-:COO/cod-:COD/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/cod-:COD/hsn-code-:hsCode/manufacturers-in-:COO/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/top-products/top-:impExp-products-from-:country-to-:country2/',
        ({ params }) => {
            const { country, country2, impExp } = params;
            const countryClean = util.parseCountryName(country);
            const country2Clean = util.parseCountryName(country2);
            return `/global-trade-data/${impExp == "import" ? country2Clean : countryClean}-${impExp}-trade-data/top-${impExp}-products-from-${countryClean}-to-${country2Clean}/`;
        }
    ],
    ['/top-products/top-:impExp-products-(from|of)-:country/',
        ({ params }) => {
            const { country, impExp } = params;
            const countryClean = util.parseCountryName(country);
            if (!regexForTopProductMultiCountry.test(countryClean)) {
                return `/global-trade-data/${countryClean}-${impExp}-trade-data/top-${impExp}-products-of-${countryClean}/`;
            }
            return '';//No need of redirect case
        }
    ],
    ['/top-products/top-export-products-from-:COO-from-:COD/', '/top-products/top-export-products-from-{COO}-to-{COD}/'],
    ['/p/:keyword/import/export-from-:COD/', '/p/{keyword}/import/import-in-{COD}/'],
    ['/p/:keyword/import-in-:COD/', '/p/{keyword}/import/import-in-{COD}/'],
    ['/p/:keyword/buyers-in-:COD/', '/p/{keyword}/buyers/buyers-in-{COD}/'],
    ['/p/:keyword/buyers-in-:COD/cod-:COO/', '/p/{keyword}/buyers/buyers-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/buyers-in-:COD/coo-:COO/', '/p/{keyword}/buyers/buyers-in-{COD}/coo-{COO}/'],
    ['/p/:keyword/manufacturers-in-:COO/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/'],
    ['/p/:keyword/manufacturers-in-:COO/coo-:COD', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/cod-{COD}/'],
    ['/p/:keyword/import/coo-:COO/import-in-:COD/hsn-code-:hsCode/', '/p/{keyword}/import/import-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/export/export-from-:COO/cod-:COD/hsn-code-:hsCode/', '/p/{keyword}/export/export-from-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/export/cod-:COD/export-from-:COO/hsn-code-:hsCode/', '/p/{keyword}/export/export-from-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/buyers/buyers-in-:COD/coo-:COO/hsn-code-:hsCode/', '/p/{keyword}/buyers/buyers-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/buyers/coo-:COO/buyers-in-:COD/hsn-code-:hsCode/', '/p/{keyword}/buyers/buyers-in-{COD}/hsn-code-{hsCode}/coo-{COO}/'],
    ['/p/:keyword/manufacturers/manufacturers-in-:COO/cod-:COD/hsn-code-:hsCode/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/hsn-code-{hsCode}/cod-{COD}/'],
    ['/p/:keyword/manufacturers/cod-:COD/manufacturers-in-:COO/hsn-code-:hsCode/', '/p/{keyword}/manufacturers/manufacturers-in-{COO}/hsn-code-{hsCode}/cod-{COD}/']
];