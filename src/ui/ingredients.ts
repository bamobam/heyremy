// How each ingredient is drawn on the prep screen: a palette colour and a simple outline, so the
// list reads as a kitchen rather than a row of emoji. Pure data, keyed by Ingredient.id.
export type IngredientShape = 'sack' | 'jug' | 'egg' | 'block' | 'jar' | 'tin' | 'shaker' | 'bottle'

export interface IngredientLook {
  color: string
  shape: IngredientShape
}

export const INGREDIENT_LOOKS: Record<string, IngredientLook> = {
  flour: { color: '#edceba', shape: 'sack' },
  milk: { color: '#b7bdb6', shape: 'jug' },
  egg: { color: '#de9762', shape: 'egg' },
  butter: { color: '#f4905f', shape: 'block' },
  sugar: { color: '#e3beb2', shape: 'jar' },
  bp: { color: '#9f9593', shape: 'tin' },
  salt: { color: '#657167', shape: 'shaker' },
  oil: { color: '#be7463', shape: 'bottle' },
}

const FALLBACK: IngredientLook = { color: '#edceba', shape: 'jar' }

export function ingredientLook(id: string): IngredientLook {
  return INGREDIENT_LOOKS[id] ?? FALLBACK
}

/** The tile's background: the ingredient's own colour, thinned out so the ink still reads. */
export function ingredientTint(id: string): string {
  return `${ingredientLook(id).color}55`
}