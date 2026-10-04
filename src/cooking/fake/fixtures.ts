// TEMPORARY (fake): the pancake demo, based on the prototype's src/prototype/remy-ui/data.ts.
// Steps use {ingredientId} placeholders like /api/parse will, so amounts scale with servings.
import type { ParsedRecipe, Verdict } from '../../types.ts'

/** Preloaded in the recipe box (§6.1 initial state). */
export const PANCAKE_RECIPE_TEXT = `Fluffy pancakes (serves 4)

1 cup flour
2 tbsp sugar
2 tsp baking powder
½ tsp salt
¾ cup milk
1 egg
2 tbsp butter, melted
Oil for the pan

Whisk the flour, sugar, baking powder and salt. Whisk in the milk, egg and melted butter until smooth. Let the batter rest for 5 minutes while you heat a pan over medium heat. Oil the pan lightly, pour ¼ cup of batter and cook until bubbles pop and stay open, then flip and cook the other side until golden.`

/** What the fake parse returns, whatever was pasted. */
export const PANCAKE_RECIPE: ParsedRecipe = {
  title: 'Fluffy pancakes',
  servings: 4,
  ingredients: [
    { id: 'flour', amount: 1, unit: 'cup', name: 'flour' },
    { id: 'milk', amount: 0.75, unit: 'cup', name: 'milk' },
    { id: 'egg', amount: 1, unit: null, name: 'egg' },
    { id: 'butter', amount: 2, unit: 'tbsp', name: 'melted butter' },
    { id: 'sugar', amount: 2, unit: 'tbsp', name: 'sugar' },
    { id: 'bp', amount: 2, unit: 'tsp', name: 'baking powder' },
    { id: 'salt', amount: 0.5, unit: 'tsp', name: 'salt' },
    { id: 'oil', amount: null, unit: null, name: 'oil for the pan' },
  ],
  prep: ['Take the egg and milk out of the fridge', 'Melt the butter', 'Get out a pan, whisk and ladle', 'Put on the hat'],
  steps: [
    {
      id: 1,
      text: 'Whisk {flour}, {sugar}, {bp} and {salt}.',
      spoken: 'Step 1. Whisk {flour}, {sugar}, {bp} and {salt}.',
      cue: null,
      checkable: false,
      headsUp: null,
    },
    {
      id: 2,
      text: 'Whisk in {milk}, {egg} and {butter} until smooth.',
      spoken: 'Step 2. Whisk in {milk}, {egg} and {butter} until smooth.',
      cue: 'smooth, no dry flour streaks',
      checkable: true,
      headsUp: null,
    },
    {
      id: 3,
      text: 'Let the batter rest for 5 minutes.',
      spoken: 'Step 3. Let the batter rest for 5 minutes.',
      cue: null,
      checkable: false,
      headsUp: 'The next step needs a hot pan. Turn it on to medium now.',
    },
    {
      id: 4,
      text: 'Oil the pan lightly and pour ¼ cup of batter.',
      spoken: 'Step 4. Oil the pan lightly and pour a quarter cup of batter.',
      cue: null,
      checkable: false,
      headsUp: null,
    },
    {
      id: 5,
      text: 'Cook until bubbles pop and stay open, then flip.',
      spoken: 'Step 5. Cook until bubbles pop and stay open, then flip.',
      cue: 'bubbles pop and stay open, edges look dry',
      checkable: true,
      headsUp: null,
    },
    {
      id: 6,
      text: 'Cook the other side until golden.',
      spoken: 'Step 6. Cook the other side until golden.',
      cue: 'golden brown underside',
      checkable: true,
      headsUp: null,
    },
  ],
}

/** The fake check cycles through these: not ready, unsure, ready. */
export const FAKE_VERDICTS: readonly Verdict[] = [
  { status: 'not_ready', feedback: 'Still some dry flour streaks. Keep whisking!' },
  { status: 'unsure', feedback: 'Look down at the bowl and hold still.' },
  { status: 'ready', feedback: 'Looks just right. On to the next step!' },
]

/** Clips voiced once per recipe, besides the steps (§6.8 voiceFlow). */
export const FIXED_CLIP_IDS = ['looking', 'done'] as const
