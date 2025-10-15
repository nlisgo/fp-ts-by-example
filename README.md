# fp-ts by Example

A collection of fp-ts exercises and examples for learning functional programming in TypeScript.

## About

This repository contains practical examples and exercises based on the [fp-ts Recipes](https://grossbart.github.io/fp-ts-recipes/#/) guide. The goal is to learn and practice functional programming concepts using the fp-ts library.

## Getting Started

Install dependencies:

```bash
npm install
```

## Available Scripts

### Development (with ts-node)
Run examples directly without building:

```bash
npm run example:dev
npm run basics:dev
npm run async:dev
npm run equality:dev
npm run ordering:dev
npm run numbers:dev
```

### Production
Build and run compiled JavaScript:

```bash
npm run build
npm run example
npm run basics
npm run async
npm run equality
npm run ordering
npm run numbers
```

### Linting
Check and fix code style:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

## Examples

- `src/example.ts` - Basic fp-ts examples including Option, Either, pipe, and chainable functions with Monoids
- `src/basics.ts` - Fundamental fp-ts concepts including pipe and flow
- `src/async.ts` - Working with asynchronous operations, promises, and tasks using Task and TaskEither
- `src/equality.ts` - Comparing values using Eq type class for primitives, structs, arrays, and complex types
- `src/ordering.ts` - Ordering and sorting with Ord type class, including custom comparators and compound orderings
- `src/numbers.ts` - Working with numbers using Monoids (sum, product, min, max), structs, tuples, and Applicative patterns

## Resources

- [fp-ts Documentation](https://gcanti.github.io/fp-ts/)
- [fp-ts Recipes](https://grossbart.github.io/fp-ts-recipes/#/) - The guide these exercises are based on
- [fp-ts Learning Resources](https://github.com/gcanti/fp-ts/blob/master/docs/learning-resources.md)

## License

ISC