# Simple Node.js Application

This is a simple Node.js application to demonstrate the usage of a `README.md` file, including installation and running instructions.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [Yarn](https://yarnpkg.com/) or npm (comes with Node.js)

---

## Getting Started

Follow the steps below to set up and run the application:

### Step 1: Install Dependencies

Run the following command to install the required dependencies:

Using **npm**:
```bash
npm install
```

### Step 2: Switch to the Application Directory
```bash
cd node-redirection-sample
```
### Step 2: Run the Application
After installing dependencies, start the application with the following command:

```bash
node index.js
```

## Prepare port data for rules
### 1: Run below command to convert trade-resource-port.json data into required json format -
```bash
node PreProcessPortsToJson.js
```
It will create a file ports.js which can directly be used in permanent redirections.

## File size comparison analysis -
1. Total records - **45453**
2. Selected columns from trade-resource-port - **PortCode, PortName, CountryName**
3. CSV - **1230 KB**
4. JSON Conversion (With Column Names - PortCode, PortName, CountryName) - **3138 KB**
5. File Conversion after PreProcessing to required optimized format - **2620 KB**