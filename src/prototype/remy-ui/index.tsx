// PROTOTYPE (throwaway): three structurally different Remy UIs on /prototype, switchable via ?variant=A|B|C.
// Question: what should Remy look like, including page transitions and the buffering mascot?
import { useEffect, useState } from 'react'
import { useFlow } from './useFlow'
import { GesturePad } from './shared'
import { PrototypeSwitcher } from '../PrototypeSwitcher'
import * as A from './VariantA'
import * as B from './VariantB'
import * as C from './VariantC'
import * as D from './VariantD'

const VARIANTS = { D: { name: D.name, C: D.VariantD }, A: { name: A.name, C: A.VariantA }, B: { name: B.name, C: B.VariantB }, C: { name: C.name, C: C.VariantC } } as const
type Key = keyof typeof VARIANTS

export default function RemyUIPrototype() {
  const flow = useFlow()
  const [search, setSearch] = useState(location.search)
  useEffect(() => {
    const on = () => setSearch(location.search)
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  const param = new URLSearchParams(search).get('variant')
  const key: Key = param && param in VARIANTS ? (param as Key) : 'D'
  const V = VARIANTS[key].C
  return (
    <>
      <V flow={flow} />
      <GesturePad flow={flow} />
      <PrototypeSwitcher variants={Object.entries(VARIANTS).map(([k, v]) => ({ key: k, name: v.name }))} current={key} />
    </>
  )
}
