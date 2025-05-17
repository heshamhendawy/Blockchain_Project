const crypto = require('crypto');
const fs = require('fs');

/**
 * Generates a key pair for use with the blockchain
 */
function generateKeyPair() {
    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'der'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'der'
        }
    });

    // Convert to hex for easier storage
    const publicKeyHex = publicKey.toString('hex');
    const privateKeyHex = privateKey.toString('hex');

    return {
        publicKey: publicKeyHex,
        privateKey: privateKeyHex
    };
}

/**
 * Saves a key pair with user info to a JSON file
 * @param {Object} keyPair - The key pair object with publicKey and privateKey
 * @param {string} filename - The filename to save to
 * @param {Object} userInfo - User information like name and ID
 */
function saveKeyPairToFile(keyPair, filename, userInfo = {}) {
    const data = JSON.stringify({
        ...keyPair,
        ...userInfo
    }, null, 2);
    
    // Ensure directory exists
    const dir = filename.substring(0, filename.lastIndexOf('/'));
    if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filename, data, 'utf8');
    console.log(`Key pair saved to ${filename}`);
}

/**
 * Generates multiple sample key pairs with user information
 * @param {number} count - Number of key pairs to generate
 * @param {string} baseFilename - Base filename pattern
 */
function generateSampleKeyPairs(count = 6, baseFilename = './samples/user') {
    const sampleUsers = [
        { name: "Hesham", id: "H0001", port: 3000 },
        { name: "Mohamed", id: "M0001", port: 3001 },
        { name: "Mostafa", id: "M0002", port: 3002 },
        { name: "Mahmoud", id: "M0003", port: 3003 },
        { name: "Mina", id: "M0004", port: 3004 },
        { name: "Abdulrahman", id: "A0001", port: 3005 }
    ];

    for (let i = 0; i < count; i++) {
        const keyPair = generateKeyPair();
        let filename;
        let userInfo = { 
            name: sampleUsers[i].name,
            id: sampleUsers[i].id,
            port: sampleUsers[i].port
        };
        
        filename = `./samples/${sampleUsers[i].name.toLowerCase()}.json`;
        
        saveKeyPairToFile(keyPair, filename, userInfo);
    }
}

// If this script is run directly, generate sample key pairs
if (require.main === module) {
    generateSampleKeyPairs();
    console.log('6 sample key pairs generated in the samples directory.');
}

module.exports = {
    generateKeyPair,
    saveKeyPairToFile,
    generateSampleKeyPairs
}; 