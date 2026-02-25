// Script para generar un token JWT de prueba para SSO
const jwt = require('jsonwebtoken');

const SSO_SECRET = '69101241e01f0b5962c8d24ab8c554e1240cf43bdff870507e2769dd03ecb4f3120cc11cdbcaebe4a34aed319a0791ca7c508ea9eeb198f972c995fce54b264b9e99a236cd7159ec48b4e60ac39503d9b836c03a92f68b3d523fb8d3bddce028';

const payload = {
  uid: 'test123456789',
  email: 'test.user@dyna.com.co',
  nombre: 'Usuario de Prueba',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 10), // 10 minutos
};

const token = jwt.sign(payload, SSO_SECRET);

console.log('\n=== TOKEN JWT DE PRUEBA PARA SSO ===\n');
console.log('Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\nToken:');
console.log(token);
console.log('\n=== URL COMPLETA PARA PROBAR ===\n');
console.log(`http://localhost:5002/api/auth/sso/dyna-login?token=${token}`);
console.log('\n');
