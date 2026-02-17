#!/usr/bin/env node
import { loadEnvFile } from '../src/config/env.js';
import { createProgram } from '../src/cli/index.js';

loadEnvFile();

const program = createProgram();
program.parse();
