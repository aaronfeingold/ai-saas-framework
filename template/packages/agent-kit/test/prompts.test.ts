import { describe, expect, it } from 'vitest';
import { promptVariables, renderPrompt } from '../src/prompts.js';

describe('prompt templates', () => {
  it('lists the variables a template uses', () => {
    expect(promptVariables('A {{wines}} and {{ dishes }} and {{wines}}')).toEqual([
      'dishes',
      'wines',
    ]);
  });

  it('fills variables and leaves the rest of the text alone', () => {
    expect(renderPrompt('Read: {{wines}} wines.', { wines: 42 })).toBe('Read: 42 wines.');
  });

  it('refuses to render when a variable is missing', () => {
    expect(() => renderPrompt('{{a}} {{b}}', { a: 1 })).toThrow(/b/);
  });

  it('does not treat a filled value as a template', () => {
    expect(renderPrompt('{{a}}', { a: '{{b}}' })).toBe('{{b}}');
  });

  it('leaves text without variables untouched', () => {
    expect(renderPrompt('No variables { here }.', {})).toBe('No variables { here }.');
  });
});
