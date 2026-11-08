// State-machine contract tests — pure node, no DOM. Run: node tests/machine.test.mjs
import { createMachine, VIEW_FSM } from '../src/25-machine.js'

let pass = 0, fail = 0
const check = (name, cond) => { if (cond) { pass += 1 } else { fail += 1; console.log(`FAIL  ${name}`) } }
const step = (m, s, e) => m.step(s, e)

/* ---- createMachine core ---- */
const M = createMachine({ initial: { n: 0 }, transitions: { INC: (s) => ({ n: s.n + 1 }), NOOP: () => null } })
check('unknown event passes through', step(M, M.initial, { type: 'NOPE' }).n === 0)
check('transition applies', step(M, M.initial, { type: 'INC' }).n === 1)
check('null return rejects', step(M, M.initial, { type: 'NOOP' }).n === 0)

/* ---- VIEW_FSM ---- */
let v = VIEW_FSM.initial
check('initial is chat', v.tab === 'chat' && !v.artifact && !v.source)

// tab guards: can't enter view/peek without their selection
v = step(VIEW_FSM, v, { type: 'TAB_VIEW' })
check('TAB_VIEW guarded without artifact', v.tab === 'chat')
v = step(VIEW_FSM, v, { type: 'TAB_PEEK' })
check('TAB_PEEK guarded without source', v.tab === 'chat')

// open artifact → view; selection persists across tab switches
v = step(VIEW_FSM, v, { type: 'OPEN_ARTIFACT', artifact: { key: 'a1' } })
check('OPEN_ARTIFACT lands on view', v.tab === 'view' && v.artifact.key === 'a1')
v = step(VIEW_FSM, v, { type: 'TAB_CHAT' })
check('artifact survives chat switch', v.tab === 'chat' && v.artifact.key === 'a1')
v = step(VIEW_FSM, v, { type: 'TAB_VIEW' })
check('TAB_VIEW allowed with artifact', v.tab === 'view')

// version stepping stays on view; clearing under view falls back to chat
v = step(VIEW_FSM, v, { type: 'STEP_ARTIFACT', artifact: { key: 'a2' } })
check('STEP_ARTIFACT keeps view', v.tab === 'view' && v.artifact.key === 'a2')
v = step(VIEW_FSM, v, { type: 'STEP_ARTIFACT', artifact: null })
check('clearing artifact exits view', v.tab === 'chat' && !v.artifact)

// source/peek symmetry
v = step(VIEW_FSM, v, { type: 'OPEN_SOURCE', source: { id: 's1' } })
check('OPEN_SOURCE lands on peek', v.tab === 'peek' && v.source.id === 's1')
v = step(VIEW_FSM, v, { type: 'STEP_SOURCE', source: { id: 's2' } })
check('STEP_SOURCE keeps peek (prev/next)', v.tab === 'peek' && v.source.id === 's2')
v = step(VIEW_FSM, v, { type: 'STEP_SOURCE', source: null })
check('clearing source exits peek', v.tab === 'chat' && !v.source)

// both selections coexist — chat can hold artifact + source memories
v = step(VIEW_FSM, v, { type: 'OPEN_ARTIFACT', artifact: { key: 'a3' } })
v = step(VIEW_FSM, v, { type: 'OPEN_SOURCE', source: { id: 's9' } })
v = step(VIEW_FSM, v, { type: 'TAB_CHAT' })
check('both memories survive chat', v.artifact.key === 'a3' && v.source.id === 's9')

// reset — notebook switch
v = step(VIEW_FSM, v, { type: 'RESET_VIEW' })
check('RESET_VIEW clears all', v.tab === 'chat' && !v.artifact && !v.source)


console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
