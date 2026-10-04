import { describe, expect, it } from 'vitest'
import type { Ingredient, Step } from '../types.ts'
import {
  describeIngredient,
  fillPlaceholders,
  formatQuantity,
  hasPlaceholders,
  scaleAmount,
  scaleFactor,
  stepClipId,
} from './scaling.ts'

const ing = (amount: number | null, unit: string | null, name = 'flour', id = 'flour'): Ingredient => ({
  id,
  amount,
  unit,
  name,
})

describe('scaleFactor and scaleAmount', () => {
  it('is the chosen servings over the recipe servings', () => {
    expect(scaleFactor(4, 8)).toBe(0.5)
    expect(scaleFactor(6, 4)).toBe(1.5)
    expect(scaleFactor(4, 4)).toBe(1)
  })

  it('multiplies an amount by the factor', () => {
    expect(scaleAmount(2, 1.5)).toBe(3)
    expect(scaleAmount(0.75, 0.5)).toBe(0.375)
  })

  it('never scales an amount that has no number, such as a pinch or to taste', () => {
    expect(scaleAmount(null, 3)).toBeNull()
  })
})

describe('formatQuantity', () => {
  it.each([
    [1, '1'],
    [2, '2'],
    [0.5, '½'],
    [0.25, '¼'],
    [0.75, '¾'],
    [1 / 3, '⅓'],
    [2 / 3, '⅔'],
    [0.125, '⅛'],
    [1.5, '1½'],
    [2.25, '2¼'],
    [1 + 2 / 3, '1⅔'],
    [2.4, '2⅓'],
    [0.9, '1'],
    [3.97, '4'],
  ])('writes %f as %s', (n, expected) => {
    expect(formatQuantity(n, 'screen')).toBe(expected)
  })

  it.each([
    [1, 'one'],
    [2, 'two'],
    [12, 'twelve'],
    [13, '13'],
    [0.5, 'half'],
    [0.25, 'a quarter'],
    [0.75, 'three quarters'],
    [1 / 3, 'a third'],
    [2 / 3, 'two thirds'],
    [0.125, 'an eighth'],
    [1.5, 'one and a half'],
    [2.25, 'two and a quarter'],
    [1.75, 'one and three quarters'],
    [1.125, 'one and an eighth'],
  ])('says %f as "%s"', (n, expected) => {
    expect(formatQuantity(n, 'spoken')).toBe(expected)
  })
})

describe('describeIngredient: cups, tablespoons and teaspoons', () => {
  // amount, unit, factor, what the screen shows, what is read aloud
  it.each([
    [1, 'cup', 1, '1 cup flour', 'one cup of flour'],
    [1, 'cup', 2, '2 cups flour', 'two cups of flour'],
    [2, 'cup', 3, '6 cups flour', 'six cups of flour'],
    [1, 'cup', 0.5, '½ cup flour', 'half a cup of flour'],
    [2, 'cup', 0.5, '1 cup flour', 'one cup of flour'],
    [1, 'cup', 1 / 3, '⅓ cup flour', 'a third of a cup of flour'],
    [0.75, 'cup', 1, '¾ cup flour', 'three quarters of a cup of flour'],
    [0.25, 'cup', 1, '¼ cup flour', 'a quarter of a cup of flour'],
    [1.5, 'cup', 1, '1½ cups flour', 'one and a half cups of flour'],
    // Halving ¾ cup is exactly 6 tbsp; that reads better than a fraction of a cup.
    [0.75, 'cup', 0.5, '6 tbsp flour', 'six tablespoons of flour'],
    [1, 'cup', 0.125, '2 tbsp flour', 'two tablespoons of flour'],
    [0.5, 'cup', 0.25, '2 tbsp flour', 'two tablespoons of flour'],
    // More than a cup that is not a clean fraction: whole cups plus tablespoons.
    [1, 'cup', 1.375, '1 cup + 6 tbsp flour', 'one cup plus six tablespoons of flour'],
    [1, 'cup', 0.2, '3 tbsp + ½ tsp flour', 'three tablespoons plus half a teaspoon of flour'],
    [1, 'tbsp', 1, '1 tbsp flour', 'one tablespoon of flour'],
    [1, 'tbsp', 3, '3 tbsp flour', 'three tablespoons of flour'],
    [2, 'tbsp', 0.5, '1 tbsp flour', 'one tablespoon of flour'],
    [1, 'tbsp', 0.5, '1½ tsp flour', 'one and a half teaspoons of flour'],
    [1, 'tbsp', 0.25, '¾ tsp flour', 'three quarters of a teaspoon of flour'],
    [0.5, 'tsp', 1, '½ tsp flour', 'half a teaspoon of flour'],
    [1, 'tbsp', 0.0417, '⅛ tsp flour', 'an eighth of a teaspoon of flour'],
    [1, 'tsp', 0.05, 'a pinch of flour', 'a pinch of flour'],
  ])('%f %s at factor %f shows "%s"', (amount, unit, factor, screen, spoken) => {
    const d = describeIngredient(ing(amount, unit), factor)
    expect(d.screen).toBe(screen)
    expect(d.spoken).toBe(spoken)
  })
})

describe('describeIngredient: metric amounts', () => {
  it.each([
    [200, 'g', 0.5, '100 g flour', '100 grams of flour'],
    [250, 'g', 0.3, '75 g flour', '75 grams of flour'],
    [333.3, 'g', 1, '333 g flour', '333 grams of flour'],
    [7, 'g', 0.5, '3.5 g flour', '3.5 grams of flour'],
    [1, 'g', 1, '1 g flour', 'one gram of flour'],
    [100, 'ml', 1.5, '150 ml flour', '150 milliliters of flour'],
    [2, 'kg', 1, '2 kg flour', 'two kilograms of flour'],
  ])('%f %s at factor %f shows "%s"', (amount, unit, factor, screen, spoken) => {
    const d = describeIngredient(ing(amount, unit), factor)
    expect(d.screen).toBe(screen)
    expect(d.spoken).toBe(spoken)
  })
})

describe('describeIngredient: other units', () => {
  it.each([
    [2, 'oz', 0.5, '1 oz flour', 'one ounce of flour'],
    [1, 'lb', 1.5, '1½ lb flour', 'one and a half pounds of flour'],
  ])('%f %s at factor %f shows "%s"', (amount, unit, factor, screen, spoken) => {
    const d = describeIngredient(ing(amount, unit), factor)
    expect(d.screen).toBe(screen)
    expect(d.spoken).toBe(spoken)
  })
})

describe('describeIngredient: whole items such as eggs', () => {
  const egg = (amount: number) => ing(amount, null, amount === 1 ? 'egg' : 'eggs', 'egg')

  it('rounds to whole numbers with no note when it comes out even', () => {
    const d = describeIngredient(egg(2), 1.5)
    expect(d.screen).toBe('3 eggs')
    expect(d.spoken).toBe('three eggs')
    expect(d.note).toBeNull()
  })

  it('has no note for a clean halving', () => {
    expect(describeIngredient(egg(4), 0.5)).toMatchObject({ screen: '2 eggs', note: null })
  })

  it('rounds half an egg up to one, and says so', () => {
    const d = describeIngredient(ing(1, null, 'egg', 'egg'), 0.5)
    expect(d.screen).toBe('1 egg')
    expect(d.spoken).toBe('one egg')
    expect(d.note).toContain('rounds to')
  })

  it('rounds 1½ eggs to 2, and says so', () => {
    const d = describeIngredient(egg(3), 0.5)
    expect(d.screen).toBe('2 eggs')
    expect(d.note).toContain('rounds to')
  })

  it('never goes below one', () => {
    const d = describeIngredient(ing(1, null, 'egg', 'egg'), 0.25)
    expect(d.screen).toBe('1 egg')
    expect(d.note).not.toBeNull()
  })

  it('keeps a fractional original as a fraction, such as half an onion', () => {
    const onion = ing(0.5, null, 'onion', 'onion')
    expect(describeIngredient(onion, 1).screen).toBe('½ onion')
    expect(describeIngredient(onion, 0.5).screen).toBe('¼ onion')
    expect(describeIngredient(onion, 0.5).note).toBeNull()
  })
})

describe('describeIngredient: amounts with no number', () => {
  it('shows just the name and never scales it', () => {
    const salt = ing(null, null, 'a pinch of salt', 'salt')
    for (const factor of [0.5, 1, 3]) {
      expect(describeIngredient(salt, factor)).toEqual({
        screen: 'a pinch of salt',
        spoken: 'a pinch of salt',
        note: null,
        changed: false,
      })
    }
  })
})

describe('describeIngredient: changed', () => {
  it('is false at the original servings', () => {
    expect(describeIngredient(ing(1, 'cup'), 1).changed).toBe(false)
  })

  it('is true when the amount shown differs from the original', () => {
    expect(describeIngredient(ing(1, 'cup'), 0.5).changed).toBe(true)
    expect(describeIngredient(ing(200, 'g'), 2).changed).toBe(true)
  })

  it('is false when rounding brings it back to the original', () => {
    expect(describeIngredient(ing(1, null, 'egg', 'egg'), 1.1).changed).toBe(false)
  })
})

describe('placeholders', () => {
  const ingredients = [ing(1, 'cup', 'flour', 'flour'), ing(1, 'cup', 'milk', 'milk'), ing(1, null, 'egg', 'egg')]

  it('detects them', () => {
    expect(hasPlaceholders('Whisk {flour} and {milk}.')).toBe(true)
    expect(hasPlaceholders('Heat the pan on medium.')).toBe(false)
    expect(hasPlaceholders('')).toBe(false)
  })

  it('fills each with the scaled amount, unit and name', () => {
    expect(fillPlaceholders('Whisk {flour} with {milk} and {egg}.', ingredients, 0.5, 'screen')).toBe(
      'Whisk ½ cup flour with ½ cup milk and 1 egg.',
    )
  })

  it('fills the spoken form in words', () => {
    expect(fillPlaceholders('Step 3. Whisk {flour} with {milk}.', ingredients, 0.5, 'spoken')).toBe(
      'Step 3. Whisk half a cup of flour with half a cup of milk.',
    )
  })

  it('fills the same placeholder wherever it appears', () => {
    expect(fillPlaceholders('{flour}, then more {flour}', ingredients, 1, 'screen')).toBe('1 cup flour, then more 1 cup flour')
  })

  it('leaves text with no placeholders alone', () => {
    expect(fillPlaceholders('Heat the pan.', ingredients, 3, 'screen')).toBe('Heat the pan.')
  })

  it('falls back to the bare id for one that is not in the recipe', () => {
    expect(fillPlaceholders('Add {mystery}.', ingredients, 1, 'screen')).toBe('Add mystery.')
  })
})

describe('stepClipId', () => {
  const step = (spoken: string): Step => ({ id: 3, text: '', spoken, cue: null, checkable: false, headsUp: null })

  it('has no servings in it when the spoken text has no amounts, so the clip survives a servings change', () => {
    expect(stepClipId(step('Step 3. Heat the pan.'), 2)).toBe('step-3')
    expect(stepClipId(step('Step 3. Heat the pan.'), 8)).toBe('step-3')
  })

  it('includes the servings when the spoken text has an amount, since the clip is different at each', () => {
    expect(stepClipId(step('Step 3. Whisk {flour}.'), 2)).toBe('step-3@2')
    expect(stepClipId(step('Step 3. Whisk {flour}.'), 4)).toBe('step-3@4')
  })
})

describe('describeIngredient across many amounts', () => {
  const amounts = [0.125, 0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 6, 10, 12, 100, 250]
  const units = ['cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'oz', 'lb', 'clove', null]
  const factors = [0.1, 0.25, 0.5, 2 / 3, 1, 1.5, 2, 3, 6, 12]

  it('never produces NaN, undefined or an empty string', () => {
    for (const amount of amounts) {
      for (const unit of units) {
        for (const factor of factors) {
          const d = describeIngredient(ing(amount, unit, 'thing'), factor)
          for (const text of [d.screen, d.spoken]) {
            expect(text, `${amount} ${unit} x${factor}`).not.toMatch(/NaN|undefined|Infinity|null/)
            expect(text.trim().length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('always includes the ingredient name', () => {
    for (const amount of amounts) {
      for (const unit of units) {
        for (const factor of factors) {
          const d = describeIngredient(ing(amount, unit, 'thing'), factor)
          expect(d.screen).toContain('thing')
          expect(d.spoken).toContain('thing')
        }
      }
    }
  })
})

describe('whole items: singular and plural', () => {
  const item = (amount: number, name: string) => ing(amount, null, name, 'x')

  it.each([
    [2, 'eggs', 0.5, '1 egg', 'one egg'],
    [1, 'egg', 3, '3 eggs', 'three eggs'],
    [2, 'eggs', 1, '2 eggs', 'two eggs'],
    [1, 'egg', 1, '1 egg', 'one egg'],
    [2, 'tomatoes', 0.5, '1 tomato', 'one tomato'],
    [1, 'tomato', 2, '2 tomatoes', 'two tomatoes'],
    [3, 'cherries', 1 / 3, '1 cherry', 'one cherry'],
    [1, 'cherry', 4, '4 cherries', 'four cherries'],
    [2, 'peaches', 0.5, '1 peach', 'one peach'],
    [1, 'peach', 2, '2 peaches', 'two peaches'],
    [2, 'red onions', 0.5, '1 red onion', 'one red onion'],
    [1, 'red onion', 3, '3 red onions', 'three red onions'],
  ])('%f %s at factor %f shows "%s"', (amount, name, factor, screen, spoken) => {
    const d = describeIngredient(item(amount, name), factor)
    expect(d.screen).toBe(screen)
    expect(d.spoken).toBe(spoken)
  })

  it('leaves a name that is the same either way alone', () => {
    expect(describeIngredient(item(2, 'asparagus'), 1).screen).toBe('2 asparagus')
    expect(describeIngredient(item(1, 'watercress'), 1).screen).toBe('1 watercress')
  })

  it('uses the right form in the rounding note', () => {
    const d = describeIngredient(item(3, 'eggs'), 0.5)
    expect(d.note).toBe('1½ eggs rounds to 2 eggs')
    expect(describeIngredient(item(1, 'egg'), 0.5).note).toBe('½ egg rounds to 1 egg')
  })

  it('writes a fraction of an item in the singular and more than one in the plural', () => {
    const onion = item(0.5, 'onions')
    expect(describeIngredient(onion, 1).screen).toBe('½ onion')
    expect(describeIngredient(onion, 3).screen).toBe('1½ onions')
  })

  it('does not touch the name of an ingredient with a unit', () => {
    expect(describeIngredient(ing(2, 'cup', 'chopped walnuts'), 1 / 16).screen).toBe('2 tbsp chopped walnuts')
  })
})
