import type { Express } from "express";

export function setupSecurity(app: Express) {
  // Configurações de segurança para produção
  
  // Headers de segurança manuais (sem helmet)
  app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // HSTS header para HTTPS
    if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    next();
  });

  // Desabilitar header X-Powered-By
  app.disable('x-powered-by');
  
  // Rate limiting para rotas sensíveis
  const loginAttempts = new Map<string, { count: number; resetTime: number }>();
  
  app.use('/api/login', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    const now = Date.now();
    const attempts = loginAttempts.get(ip);
    
    if (attempts) {
      if (now < attempts.resetTime) {
        if (attempts.count >= 5) {
          return res.status(429).json({ 
            error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' 
          });
        }
        attempts.count++;
      } else {
        loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 minutos
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    }
    
    next();
  });
  
  // Limpar mapa de tentativas periodicamente
  setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
      if (now > attempts.resetTime) {
        loginAttempts.delete(ip);
      }
    }
  }, 60 * 1000); // A cada minuto
}