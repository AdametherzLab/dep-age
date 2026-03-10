#!/usr/bin/env node
import { initHealthHistory } from './history';
// ... existing imports ...

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) { printHelp(); return; }

  // Add history commands
  if (args.viewHistory) {
    const healthHistory = initHealthHistory(args.dbPath as string);
    const start = new Date(args.start as string || Date.now() - 30 * 86400000);
    const end = new Date(args.end as string || Date.now());
    
    const history = await healthHistory.getHistory(start, end);
    
    if (args.format === 'json') {
      console.log(JSON.stringify(history, null, 2));
    } else {
      console.log(`\n${ANSI.bold}Health History (${start.toISOString().slice(0,10)} to ${end.toISOString().slice(0,10)})${ANSI.reset}`);
      history.forEach(entry => {
        const gc = gradeColor(entry.grade);
        console.log(`[${new Date(entry.timestamp).toISOString().slice(0,10)}] ${gc}${entry.score}%${ANSI.reset} - ${entry.abandonedCount} abandoned`);
      });
    }
    return;
  }

  // ... existing scanning code ...

  // Save history if requested
  if (args.saveHistory) {
    const healthHistory = initHealthHistory(args.dbPath as string);
    await healthHistory.saveSnapshot(health);
    if (format === 'text') {
      console.log(`${ANSI.dim}Saved health snapshot to history${ANSI.reset}`);
    }
  }

  // ... rest of existing main function ...
}

// Update parseArgs to handle new options
function parseArgs(argv: string[]): Record<string, string | boolean> {
  // ... existing logic ...
  if (arg === '--save-history') { args.saveHistory = true; continue; }
  if (arg === '--view-history') { args.viewHistory = true; continue; }
  if (arg === '--db-path') { args.dbPath = argv[++i]; continue; }
  // ... rest of parser ...
}

// Update help text
function printHelp(): void {
  console.log(`
${ANSI.bold}New Options:${ANSI.reset}
  --save-history       Save current health score to history database
  --view-history       View historical health trends
  --start <date>       Start date for history view (ISO format)
  --end <date>         End date for history view (ISO format)
  --db-path <path>     Custom path for history database (default: ./dep-age-history.sqlite)
`);
  // ... rest of help text ...
}
