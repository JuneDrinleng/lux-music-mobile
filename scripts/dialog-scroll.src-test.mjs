/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const parse = file => ts.createSourceFile(file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const dialog = parse('src/components/magazine/MagDialog.tsx')
const version = parse('src/navigation/components/VersionModal.tsx')
const findAll = (node, predicate) => {
  const found = []
  const visit = child => {
    if (predicate(child)) found.push(child)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}
const one = (nodes, label) => {
  assert.equal(nodes.length, 1, label)
  return nodes[0]
}
const unwrap = node => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node
const tag = node => ts.isJsxElement(node) ? node.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(node) ? node.tagName.getText() : ''
const attributes = node => (ts.isJsxElement(node) ? node.openingElement : node).attributes.properties
const attribute = (node, name) => one(attributes(node).filter(prop => ts.isJsxAttribute(prop) && prop.name.text === name), `${tag(node)}.${name}`)
const value = (node, name) => {
  const { initializer } = attribute(node, name)
  return initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer
}
const expression = (node, name, text) => assert.equal(value(node, name)?.getText(), text, `${tag(node)}.${name}`)
const enabled = (node, name) => assert.ok(attribute(node, name).initializer === undefined || value(node, name)?.kind === ts.SyntaxKind.TrueKeyword, `${tag(node)}.${name}`)
const children = node => node.children.filter(child => !ts.isJsxText(child) && (!ts.isJsxExpression(child) || child.expression))
const variable = (node, name) => one(findAll(node, child => ts.isVariableDeclaration(child) && child.name.getText() === name), `variable ${name}`)
const component = name => {
  const initializer = variable(dialog, name).initializer
  assert.ok(ts.isCallExpression(initializer) && initializer.expression.getText() === 'memo', `${name} remains memoized`)
  assert.ok(ts.isArrowFunction(initializer.arguments[0]))
  return initializer.arguments[0]
}
const magDialog = component('MagDialog')
const assertPassiveView = node => {
  assert.equal(tag(node), 'View', 'the card uses an ordinary View')
  for (const prop of attributes(node)) {
    assert.ok(ts.isJsxAttribute(prop), 'card containers do not spread touch responder props')
    assert.doesNotMatch(prop.name.text, /^on(?:Press|Touch)|Responder/, 'card containers must not claim child scroll/input gestures')
  }
}

test('MagDialog keeps the backdrop and passive card as siblings in both hosts', () => {
  const content = unwrap(variable(magDialog, 'content').initializer)
  assertPassiveView(content)
  expression(content, 'style', 'styles.root')
  const parts = children(content)
  assert.equal(parts.length, 2, 'one independent backdrop followed by the card')
  const [backdrop, card] = parts
  assert.equal(tag(backdrop), 'Pressable')
  expression(backdrop, 'style', 'StyleSheet.absoluteFill')
  assert.ok(ts.isJsxExpression(card) && card.expression?.getText() === 'card', 'the card is above the sibling backdrop')
  assert.equal(card.parent, content)
  assert.equal(tag(unwrap(variable(magDialog, 'card').initializer)), 'DialogCard')

  const touchWrappers = findAll(magDialog, node => /^(?:Touchable\w*|Pressable)$/.test(tag(node)))
  assert.deepEqual(touchWrappers, [backdrop], 'only the independent backdrop is pressable; no Touchable or Pressable wraps the card')
  const cardRoot = unwrap(one(findAll(component('DialogCard').body, ts.isReturnStatement), 'DialogCard return').expression)
  assertPassiveView(cardRoot)
  expression(cardRoot, 'collapsable', 'false')
  assert.equal(findAll(cardRoot, node => /^(?:Touchable\w*|Pressable)$/.test(tag(node))).length, 0, 'DialogCard must not wrap its body or children in a touch responder')

  const embedded = one(findAll(magDialog.body, node => ts.isIfStatement(node) && node.expression.getText() === 'embedded'), 'embedded branch')
  assert.equal(one(findAll(embedded.thenStatement, ts.isReturnStatement), 'embedded return').expression.getText(), 'content')
  const modal = one(findAll(magDialog.body, node => tag(node) === 'Modal'), 'native Modal')
  const modalChildren = children(modal)
  assert.equal(modalChildren.length, 1)
  assert.ok(ts.isJsxExpression(modalChildren[0]) && modalChildren[0].expression?.getText() === 'content', 'native Modal shares the same gesture-safe content')
})

test('MagDialog preserves visibility, backdrop gating, native fade and Android return behavior', () => {
  const backdrop = one(findAll(magDialog.body, node => tag(node) === 'Pressable'), 'independent backdrop')
  const handler = value(backdrop, 'onPress')
  assert.ok(ts.isConditionalExpression(handler))
  assert.equal(handler.condition.getText(), 'bgHide')
  assert.equal(handler.whenTrue.getText(), 'onClose')
  assert.equal(handler.whenFalse.getText(), 'undefined')
  expression(backdrop, 'accessible', 'false')

  const defaults = magDialog.parameters[0].name.elements
  assert.equal(defaults.find(item => item.name.getText() === 'bgHide').initializer.getText(), 'true')
  assert.equal(defaults.find(item => item.name.getText() === 'embedded').initializer.getText(), 'false')
  const hidden = one(findAll(magDialog.body, node => ts.isIfStatement(node) && node.expression.getText() === '!visible'), 'hidden guard')
  assert.equal(one(findAll(hidden.thenStatement, ts.isReturnStatement), 'hidden return').expression.kind, ts.SyntaxKind.NullKeyword)
  const modal = one(findAll(magDialog.body, node => tag(node) === 'Modal'), 'native Modal')
  for (const name of ['transparent', 'visible', 'statusBarTranslucent']) enabled(modal, name)
  assert.equal(value(modal, 'animationType').text, 'fade')
  expression(modal, 'onRequestClose', 'onClose')
})

test('MagDialog action callbacks and disabled/danger flags remain on the actual buttons', () => {
  const card = component('DialogCard')
  const cancel = one(findAll(card, node => tag(node) === 'SecondaryButton'), 'cancel button')
  expression(cancel, 'label', 'cancelLabel')
  expression(cancel, 'onPress', 'onCancel ?? onClose')
  const confirm = one(findAll(card, node => tag(node) === 'PrimaryButton'), 'confirm button')
  for (const [name, expected] of [['label', 'confirmLabel'], ['onPress', 'onConfirm'], ['disabled', 'confirmDisabled'], ['danger', 'confirmDanger']]) expression(confirm, name, expected)
  const extra = one(findAll(card, node => tag(node) === 'TextButton'), 'extra button')
  expression(extra, 'label', 'extraLabel')
  expression(extra, 'onPress', 'onExtra')
})

test('VersionModal retains a bounded nested ScrollView around the complete changelog', () => {
  const host = one(findAll(version, node => tag(node) === 'MagDialog'), 'version dialog')
  enabled(host, 'embedded')
  expression(host, 'bgHide', 'false')
  const scroll = one(findAll(host, node => tag(node) === 'ScrollView'), 'changelog ScrollView')
  expression(scroll, 'style', 'styles.descScroll')
  enabled(scroll, 'nestedScrollEnabled')
  const changelog = one(findAll(scroll, node => tag(node) === 'ChangelogView'), 'changelog inside ScrollView')
  expression(changelog, 'desc', 'versionInfo.newVersion.desc')
  enabled(changelog, 'compact')
  const bounds = one(findAll(version, node => ts.isPropertyAssignment(node) && node.name.getText() === 'descScroll'), 'descScroll style')
  assert.ok(ts.isObjectLiteralExpression(bounds.initializer))
  const maxHeight = one(bounds.initializer.properties.filter(node => ts.isPropertyAssignment(node) && node.name.getText() === 'maxHeight'), 'changelog height bound')
  assert.equal(maxHeight.initializer.getText(), '220')
})
