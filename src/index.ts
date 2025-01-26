#!/usr/bin/env node

import * as commander from 'npm:commander';
import { format } from 'jsr:@std/semver';

import VERSION from './version.ts';
import exportCommand from './commands/export.ts';
import importCommand from './commands/import.ts';

const program = new commander.Command();

program
  .description(
    'Migrate GitHub projects (https://docs.github.com/en/issues/planning-and-tracking-with-projects) between GitHub products, organizations and users',
  )
  .version(format(VERSION))
  .addCommand(exportCommand)
  .addCommand(importCommand);

program.parse();
