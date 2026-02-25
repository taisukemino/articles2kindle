import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jsdoc from 'eslint-plugin-jsdoc'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'drizzle/**', '*.min.js'],
  },

  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,

  {
    files: ['src/**/*.ts', 'bin/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      jsdoc,
    },
    rules: {
      // No `any` types — use `unknown` instead
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // `const` over `let`, no `var`
      'prefer-const': 'error',
      'no-var': 'error',

      // File max 300 lines (code only)
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],

      // No unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Prefer async/await
      '@typescript-eslint/no-floating-promises': 'error',

      // TSDoc for exported functions
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: ['ExportNamedDeclaration > FunctionDeclaration'],
        },
      ],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        // Default: camelCase
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        // Imports: camelCase or PascalCase (class imports like Database)
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        // Variables: camelCase, UPPER_CASE (constants), or PascalCase
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        // Functions: camelCase
        {
          selector: 'function',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        // Parameters: camelCase
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        // Types, interfaces, enums: PascalCase
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        // Enum members: UPPER_CASE
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
        // Properties with special chars (HTTP headers, external API fields): skip format check
        {
          selector: 'property',
          format: null,
          filter: { regex: '[^a-zA-Z0-9_]', match: true },
        },
        // Properties: allow snake_case too (database columns, external API fields)
        {
          selector: 'property',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'],
          leadingUnderscore: 'allow',
        },
        // Object literal methods: camelCase or UPPER_CASE
        {
          selector: 'objectLiteralMethod',
          format: ['camelCase', 'UPPER_CASE'],
        },
      ],

      // Relax strict preset defaults
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General quality
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  }
)
