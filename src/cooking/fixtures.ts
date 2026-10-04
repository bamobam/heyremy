// A sample recipe in the shape /api/parse returns. Used by tests, and as the
// dev mock before the backend exists.

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
      cue: 'Batter is smooth with no dry flour streaks',
      checkable: true,
      headsUp: 'Next step needs a hot pan. Turn it on now.',
    },
    {
      id: 2,
      text: 'Heat the pan on medium and melt {butter}.',
      spoken: 'Step 2. Heat the pan on medium and melt {butter}.',
      cue: 'Butter is melted and foaming',
      checkable: true,
      headsUp: null,
    },
    {
      id: 3,
      text: 'Pour a ladle of batter into the pan.',
      spoken: 'Step 3. Pour a ladle of batter into the pan.',
      cue: null,
      checkable: false,
      headsUp: null,
    },
    {
      id: 4,
      text: 'Flip when bubbles form on top.',
      spoken: 'Step 4. Flip when bubbles form on top.',
      cue: 'Bubbles on top and the edges look set',
      checkable: true,
      headsUp: null,
    },
    {
      id: 5,
      text: 'Serve with butter and syrup.',
      spoken: 'Step 5. Serve with butter and syrup.',
      cue: null,
      checkable: false,
      headsUp: null,
    },
  ],
}
