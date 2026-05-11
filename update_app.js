import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/const allowedKey = availableKeys\.find\(k => k\.keyValue === selectedApiKey && \(!k\.assignedTo \|\| k\.assignedTo === user\?\.email\)\);/g, 'const allowedKey = availableKeys.find(k => k.keyValue === selectedApiKey && (k.assignedTo === user?.email || isAdmin));');
content = content.replace(/if \(!selectedApiKey \|\| !allowedKey\) throw new Error\("Please select a valid API Key first\."\);/g, 'if (!selectedApiKey || !allowedKey) throw new Error("Please select a valid assigned API Key first. Only an Admin can assign you an API Key.");');
fs.writeFileSync('src/App.tsx', content);
