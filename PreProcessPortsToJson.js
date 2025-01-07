import fs from 'fs';
import path from 'path';
import globalCountries from './globalCountry.js';
const isPort = false;
if (isPort) {
    // Read the JSON file
    const filePath = path.resolve('./trade-resource-port.json');
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    const portNameMap = new Map();

    for (const { PortName, CountryName, PortCode } of data) {
        portNameMap.set(PortName.toLowerCase(), [PortCode, CountryName]);
    }

    fs.writeFileSync('./ports.js', `export default ${JSON.stringify(Object.fromEntries(portNameMap))};`);
}
else {
    const countriesArray = Object.values(globalCountries).map(country => country.toLowerCase());

    // Save the array to a new file
    fs.writeFileSync('./countryLookup.js', `export default ${JSON.stringify(countriesArray)}`);
}