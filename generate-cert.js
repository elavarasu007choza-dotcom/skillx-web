const fs = require('fs');
const { execSync } = require('child_process');

// For Windows, use PowerShell to generate a self-signed certificate
const scriptPath = 'gen-cert.ps1';

const psScript = `
# Generate self-signed certificate for localhost
$cert = New-SelfSignedCertificate -CertStoreLocation cert:\\CurrentUser\\My -DnsName localhost -NotAfter (Get-Date).AddYears(1)
$password = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert "cert:\\CurrentUser\\My\\$($cert.Thumbprint)" -FilePath "cert.pfx" -Password $password
Write-Host "Certificate generated: cert.pfx"
`;

fs.writeFileSync(scriptPath, psScript);
console.log('Run: powershell -ExecutionPolicy Bypass -File gen-cert.ps1');
