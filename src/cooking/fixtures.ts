// A sample recipe in the shape /api/parse returns. Used by tests, and as the
// dev mock before the backend exists. Each step is narrated at the three Levels (beginner is `spoken`).

import type { ParsedRecipe } from '../types.ts'

export const pancakes: ParsedRecipe = {
  title: 'Pancakes',
  servings: 4,
  ingredients: [
    { id: 'flour', amount: 1, unit: 'cup', name: 'flour' },
    { id: 'milk', amount: 1, unit: 'cup', name: 'milk' },
    { id: 'egg', amount: 2, unit: null, name: 'eggs' },
    { id: 'butter', amount: 2, unit: 'tbsp', name: 'melted butter' },
    { id: 'salt', amount: null, unit: null, name: 'a pinch of salt' },
  ],
  prep: ['Take the egg and milk out of the fridge', 'Get out a pan and a ladle'],
  steps: [
    {
      id: 1,
      text: 'Whisk {flour}, {milk} and {egg} into a batter.',
      spoken: 'Step 1. Whisk {flour}, {milk} and {egg} into a batter.',
      spokenIntermediate: 'Step 1. Whisk {flour}, {milk} and {egg}.',
      spokenMaster: 'Step 1. Whisk {flour}, {milk}, {egg}.',
      cue: 'Batter is smooth with no dry flour streaks',
      checkable: true,
      headsUp: 'Next step needs a hot pan. Turn it on now.',
    },
    {
      id: 2,
      text: 'Heat the pan on medium and melt {butter}.',
      spoken: 'Step 2. Heat the pan on medium and melt {butter}.',
      spokenIntermediate: 'Step 2. Pan on medium, melt {butter}.',
      spokenMaster: 'Step 2. Medium heat, {butter}.',
      cue: 'Butter is melted and foaming',
      checkable: true,
      headsUp: null,
      timeDependent: true,
    },
    {
      id: 3,
      text: 'Pour a ladle of batter into the pan.',
      spoken: 'Step 3. Pour a ladle of batter into the pan.',
      spokenIntermediate: 'Step 3. Pour a ladle of batter.',
      spokenMaster: 'Step 3. Pour a ladle.',
      cue: null,
      checkable: false,
      headsUp: null,
    },
    {
      id: 4,
      text: 'Flip when bubbles form on top.',
      spoken: 'Step 4. Flip when bubbles form on top.',
      spokenIntermediate: 'Step 4. Flip at the bubbles.',
      spokenMaster: 'Step 4. Flip on bubbles.',
      cue: 'Bubbles on top and the edges look set',
      checkable: true,
      headsUp: null,
      timeDependent: true,
    },
    {
      id: 5,
      text: 'Serve with butter and syrup.',
      spoken: 'Step 5. Serve with butter and syrup.',
      // No spokenIntermediate: a step saved before Levels existed (or a model that skipped one) reads `spoken`.
      spokenMaster: 'Step 5. Serve.',
      cue: null,
      checkable: false,
      headsUp: null,
    },
  ],
}
