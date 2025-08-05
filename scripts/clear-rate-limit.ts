import dotenv from 'dotenv';
import { db } from '../db';

dotenv.config();

console.log('Script para limpar bloqueios de rate limit');
console.log('=========================================');
console.log('');
console.log('Este script vai limpar todos os bloqueios de tentativas de login.');
console.log('');
console.log('NOTA: O sistema de rate limit é armazenado em memória,');
console.log('então será necessário reiniciar o servidor para limpar os bloqueios.');
console.log('');
console.log('Para evitar futuros bloqueios, lembre-se:');
console.log('- Máximo de 10 tentativas de login a cada 15 minutos');
console.log('- Use a senha correta ou resete a senha se esqueceu');
console.log('');
console.log('Script concluído! Reinicie o servidor para aplicar as mudanças.');

process.exit(0);