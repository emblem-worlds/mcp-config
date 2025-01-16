import { readFile } from 'fs/promises';

export async function loadConfig(path) {
  try {
    const configData = await readFile(path, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading config:', error);
    return {};
  }
}
