import React from 'react'
import * as reactRedux from 'react-redux'
import * as redux from 'redux'
import * as reselect from 'reselect'
import * as immutable from 'immutable'

import {actions} from './state'
import {SkuPopup} from './popup'
import * as selectors from './selectors'
import EditableCell from './editable_cell'
import {makePurchaseLinesSelector} from './process_bom'

class SkuCell extends React.Component {
  shouldComponentUpdate(newProps) {
    return Object.keys(newProps).reduce((prev, k) => {
      if (prev) {
        return true
      }
      // don't update when 'field' updates as it never actually changes
      if (k === 'field') {
        return false
      }
      // use deeper equality for suggestions
      if (k === 'suggestions' && newProps[k] !== this.props[k]) {
        return !newProps.suggestions.equals(this.props.suggestions)
      }
      return newProps[k] !== this.props[k]
    }, false)
  }
  handlePopupOpen = () => {
    this.props.setPopupFocus([this.props.lineId, this.props.field])
  }
  handlePopupClose = () => {
    this.props.setPopupFocus([null, null])
  }
  render() {
    const props = this.props
    const {value, lineId, field, setField, setFocus, active} = props
    const cell = (
      <EditableCell
        field={field}
        value={value}
        lineId={lineId}
        setField={setField}
        setFocus={setFocus}
        loseFocus={props.loseFocus}
        active={active}
        match={props.match}
        selectedCheck={props.selectedCheck}
        suggestionCheck={props.suggestionCheck}
        setFocusBelow={props.setFocusBelow}
        setFocusNext={props.setFocusNext}
        previewBuy={props.previewBuy}
        highlight={props.highlight}
      />
    )
    if (!props.hidden && (value || props.suggestions.size > 0)) {
      return (
        <SkuPopup
          on="click"
          value={value}
          trigger={cell}
          field={field}
          lineId={props.lineId}
          onOpen={this.handlePopupOpen}
          onClose={this.handlePopupClose}
          position="bottom right"
          suggestions={props.suggestions}
          selected={props.selected}
          setField={setField}
          remove={props.remove}
          expanded={props.skuPopupExpanded}
          setExpanded={props.setSkuPopupExpanded}
          previewBuy={props.previewBuy}
          alwaysBuy={props.alwaysBuy}
          toggleAlwaysBuyHere={props.toggleAlwaysBuyHere}
        />
      )
    }
    return cell
  }
}

function retailerSelector(_, props) {
  return props.field.get(1)
}

function makeAlwaysBuyThisSelector() {
  const skuSelector = makeSkuSelector()
  return reselect.createSelector(
    [selectors.lineId, skuSelector, selectors.alwaysBuySkus],
    (lineId, sku, alwaysBuySkus) => {
      return alwaysBuySkus.getIn([lineId, sku])
    }
  )
}

function retailerSuggestions(state, props) {
  return state.suggestions.getIn([props.lineId, 'retailers']) || immutable.Map()
}

function makeApplicableSuggestions(valueSelector) {
  return reselect.createSelector(
    [retailerSuggestions, retailerSelector, valueSelector],
    (retailerSuggestions, retailer, value) => {
      let suggestions = retailerSuggestions.get(retailer) || immutable.List()
      const sku = immutable.Map({vendor: retailer, part: value})
      if (value && !suggestions.find(s => s.get('sku').equals(sku))) {
        suggestions = suggestions.unshift(
          immutable.Map({
            sku,
            checkColor: 'red',
            partData: immutable.Map({
              description: 'Sorry, no part information found'
            })
          })
        )
      }
      return suggestions
    }
  )
}

function makeMatchSelector(
  applicableSuggestionsSelector,
  valueSelector,
  selectedSelector,
  suggestionCheckSelector
) {
  return reselect.createSelector(
    [
      applicableSuggestionsSelector,
      valueSelector,
      selectedSelector,
      suggestionCheckSelector
    ],
    (suggestions, value, selected, suggestionCheck) => {
      if (selected >= 0) {
        suggestions = suggestions.delete(selected)
      }
      if (suggestionCheck) {
        return suggestions.getIn([0, 'type'])
      }
      if (value) {
        return false
      }
      return suggestions.getIn([0, 'type'])
    }
  )
}

function makeSuggestionCheckSelector(
  applicableSuggestionsSelector,
  selectedSelector,
  selectedCheckSelector
) {
  return reselect.createSelector(
    [
      selectors.value,
      applicableSuggestionsSelector,
      selectedSelector,
      selectedCheckSelector
    ],
    (value, suggestions, selected, selectedCheck) => {
      if (!suggestions.first()) {
        return null
      }
      if (selected >= 0 && !selectedCheck) {
        return null
      }
      if (selected >= 0) {
        suggestions = suggestions.delete(selected)
      }
      const first = suggestions.first()
      const check = first ? first.get('checkColor') : null
      if (check === 'red') {
        return null
      }
      if (selectedCheck === check) {
        return null
      }
      return check
    }
  )
}

function makeSelectedCheckSelector(
  applicableSuggestionsSelector,
  selectedSelector,
  matchingSelector
) {
  return reselect.createSelector(
    [
      applicableSuggestionsSelector,
      selectedSelector,
      selectors.value,
      matchingSelector
    ],
    (suggestions, selected, value, matching) => {
      if (matching !== 'done') {
        return null
      }
      if (selected >= 0) {
        const checkColor = suggestions.getIn([selected, 'checkColor'])
        if (checkColor === 'green') {
          return null
        }
        return checkColor
      }
      if (value) {
        return 'red'
      }
      return null
    }
  )
}

function makeSkuSelector() {
  return reselect.createSelector(
    [retailerSelector, selectors.value],
    (vendor, part) => immutable.Map({vendor, part})
  )
}

function makeSelectedSelector(suggestions) {
  const skuSelector = makeSkuSelector()
  return reselect.createSelector(
    [suggestions, skuSelector],
    (suggestions, sku) => suggestions.findIndex(s => s.get('sku').equals(sku))
  )
}

function skuPopupExpanded(state) {
  return state.view.get('skuPopupExpanded')
}

function preferredRetailerSelector(state) {
  return state.view.get('preferredRetailer')
}

function makeRetailersSelector() {
  const purchaseLinesSelector = makePurchaseLinesSelector(
    preferredRetailerSelector,
    selectors.lines,
    selectors.suggestions
  )
  return reselect.createSelector(
    [selectors.lines, selectors.previewBuy, purchaseLinesSelector],
    (lines, previewBuy, purchaseLines) => {
      return purchaseLines.map(l => l.get('retailers'))
    }
  )
}

function makeNonPreviewRetailerSelector() {
  return reselect.createSelector(
    [selectors.lines],
    lines => {
      return lines.map(l => l.get('retailers'))
    }
  )
}

function makeRetailerValueSelector(lineId, field, retailersSelector) {
  const retailer = field.last()
  return reselect.createSelector(
    [retailersSelector],
    retailers => {
      return retailers.getIn([lineId, retailer])
    }
  )
}

function makePreviewRetailerValueSelector(lineId, field, retailersSelector) {
  const retailer = field.last()
  return reselect.createSelector(
    [retailersSelector],
    retailers => {
      return retailers.getIn([lineId, retailer])
    }
  )
}

function makeDesiredQuantitySelector() {
  return reselect.createSelector(
    [
      selectors.line,
      selectors.buyMultiplier,
      selectors.buyExtra,
      selectors.buyExtraPercent
    ],
    (line, buyMultiplier, buyExtra, buyExtraPercent) => {
      const q = line.get('quantity')
      buyExtra = buyExtra ? buyExtraPercent / 100 : 0
      return Math.ceil(q * buyMultiplier + q * buyMultiplier * buyExtra)
    }
  )
}

function makeNotEnoughStockSelector(lineId, retailersSelector) {
  const desiredQuantitySelector = makeDesiredQuantitySelector()
  return reselect.createSelector(
    [desiredQuantitySelector, retailersSelector],
    (desiredQuantity, retailers) => {
      return (
        retailers.get(lineId).reduce((p, x) => p + x.get('quantity'), 0) !==
        desiredQuantity
      )
    }
  )
}

function makeHighlightSelector(
  notEnoughStockSelector,
  valueSelector,
  alwaysBuySelector
) {
  return reselect.createSelector(
    [notEnoughStockSelector, valueSelector, alwaysBuySelector],
    (notEnoughStock, value, alwaysBuy) => {
      return alwaysBuy
        ? 'darkblue'
        : value.get('quantity') > 0
        ? notEnoughStock
          ? 'orange'
          : 'blue'
        : notEnoughStock
        ? 'red'
        : 'blank'
    }
  )
}

function mapStateToProps(state, props) {
  const active = selectors.makeActiveSelector()
  const retailers = makeRetailersSelector()
  const value = makePreviewRetailerValueSelector(
    props.lineId,
    props.field,
    retailers
  )
  const nonPreviewRetailers = makeNonPreviewRetailerSelector()
  const nonPreviewValue = makeRetailerValueSelector(
    props.lineId,
    props.field,
    nonPreviewRetailers
  )
  const suggestions = makeApplicableSuggestions(nonPreviewValue)
  const selected = makeSelectedSelector(suggestions)
  const matching = selectors.makeSuggestionsMatching()
  const selectedCheck = makeSelectedCheckSelector(
    suggestions,
    selected,
    matching
  )
  const notEnoughStock = makeNotEnoughStockSelector(props.lineId, retailers)
  const suggestionCheck = makeSuggestionCheckSelector(
    suggestions,
    selected,
    selectedCheck
  )
  const match = makeMatchSelector(
    suggestions,
    selectors.value,
    selected,
    suggestionCheck
  )
  const alwaysBuy = makeAlwaysBuyThisSelector()
  const highlight = makeHighlightSelector(notEnoughStock, value, alwaysBuy)
  return reselect.createSelector(
    [
      nonPreviewValue,
      active,
      suggestions,
      match,
      suggestionCheck,
      selectedCheck,
      selected,
      skuPopupExpanded,
      selectors.previewBuy,
      highlight,
      alwaysBuy
    ],
    (
      nonPreviewValue,
      active,
      suggestions,
      match,
      suggestionCheck,
      selectedCheck,
      selected,
      skuPopupExpanded,
      previewBuy,
      highlight,
      alwaysBuy
    ) => ({
      value: nonPreviewValue,
      active,
      suggestions,
      match,
      suggestionCheck,
      selectedCheck,
      selected,
      skuPopupExpanded,
      previewBuy,
      highlight,
      alwaysBuy
    })
  )
}

function mapDispatchToProps(dispatch) {
  return redux.bindActionCreators(actions, dispatch)
}

export default reactRedux.connect(mapStateToProps, mapDispatchToProps)(SkuCell)
