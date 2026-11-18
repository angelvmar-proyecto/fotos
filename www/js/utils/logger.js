class Logger {
  constructor() { this.logs = []; this.startTime = Date.now(); }
  info(msg) { this.log('INFO', msg); }
  error(msg) { this.log('ERROR', msg); console.error(msg); }
  log(level, message) {
    this.logs.push({ timestamp: Date.now() - this.startTime, level, message });
    console.log(`[${level}] ${message}`);
  }
  getLogs() { return this.logs; }
  getLogsText() { 
    return this.logs.map(l => `[${l.timestamp}ms] [${l.level}] ${l.message}`).join('\n'); 
  }
}
const logger = new Logger();
