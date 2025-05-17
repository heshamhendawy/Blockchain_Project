const crypto = require('crypto');
const fs = require('fs');

// Helper function to generate key pair
function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    
    return { publicKey, privateKey };
}

// Create a configuration file for a node
function createConfig(name, port) {
    const keyPair = generateKeyPair();
    const config = {
        name,
        port,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey
    };
    
    // Write to file
    fs.writeFileSync(`./samples/${name}.json`, JSON.stringify(config, null, 2));
    console.log(`Configuration for ${name} created successfully!`);
    
    return config;
}

// Load configuration from file
function loadConfig(path) {
    try {
        const data = fs.readFileSync(path);
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading config: ${error.message}`);
        return null;
    }
}

module.exports = {
    generateKeyPair,
    createConfig,
    loadConfig
};