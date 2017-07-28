import './App.css'
import 'semantic-ui-css/semantic.css'

const React       = require('react')
const semantic    = require('semantic-ui-react')
const redux       = require('redux')
const reactRedux  = require('react-redux')
const superagent  = require('superagent')
const oneClickBom = require('1-click-bom')
const immutable   = require('immutable')

const {mainReducer, initialState, actions} = require('./state')
const store = redux.createStore(mainReducer, initialState)

const Bom = React.createClass({
  getInitialState() {
    return store.getState().toJS()
  },
  render() {
    const editing = this.props.editable ? this.state.view.editing : null
    return (
      <semantic.Table
        className='Bom'
        size='small'
        celled
        compact
        unstackable={true}
        singleLine
      >
        <Header lines={this.state.editable.lines} />
        <Body editing={editing} lines={this.state.editable.lines} />
      </semantic.Table>
    )
  },
  componentDidMount() {
    superagent.get('1-click-BOM.tsv').then(r => {
      store.dispatch(actions.setFromTsv(r.text))
    })
    store.subscribe(() => {
      const state = store.getState().toJS()
      this.setState(state)
    })
  },
})

function Header({lines}) {
  const maxMpns = oneClickBom.lineData.maxMpns(lines)
  return (
    <thead>
      <tr>
        <th>
          <a onClick={() => store.dispatch(actions.sortBy('reference'))}>
            References
          </a>
        </th>
        <th >
          <a onClick={() => store.dispatch(actions.sortBy('quantity'))}>
            Qty
          </a>
        </th>
        {(() => {
          const cells = []
          for (let i = 0; i < maxMpns; ++i) {
            cells.push(
              <th key={`Manufacturer${i}`}>
                <a onClick={() => store.dispatch(actions.sortBy(['manufacturer', i]))}>
                  Manufacturer
                </a>
              </th>
            )
            cells.push(
              <th key={`MPN${i}`}>
                <a onClick={() => store.dispatch(actions.sortBy(['part', i]))}>
                  MPN
                </a>
              </th>
            )
          }
          return cells
        })()}
        {oneClickBom.lineData.retailer_list.map(retailer => {
          return (
            <th key={retailer}>
              <a onClick={() => store.dispatch(actions.sortBy(retailer))}>
                {retailer}
              </a>
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

function Body({editing, lines}) {
  const maxMpns = oneClickBom.lineData.maxMpns(lines)

  return (
    <tbody>
      {lines.map(line => Row({editing, line, maxMpns}))}
    </tbody>
  )
}

const EditInput = React.createClass({
  getInitialState() {
    return {value: this.props.value}
  },
  handleChange(event) {
    this.setState({value: event.target.value})
    this.props.onChange(event)
  },
  render() {
    return (
      <input
        spellCheck={false}
        value={this.state.value}
        onChange={this.handleChange}
        ref={input => {this.input = input}}
        size={this.state.value.length + 5}
        type={this.props.type}
        key={this.props.key}
      />
    )
  },
  componentDidMount() {
    this.input.focus()
  },
})

function editingThis(editing, id, field) {
  return immutable.fromJS(editing).equals(immutable.fromJS([id, field]))
}

function setField(id, field) {
  return event => store.dispatch(actions.set({
    id,
    field,
    value: event.target.value,
  }))
}

function EditableCell({editing, line, field}) {
  if (field[0] === 'reference') {
    var className = `marked ${markerColor(line.getIn(field))}`
  } else if (field[0] === 'quantity') {
    var type = 'number'
  }
  const id = line.get('id')
  const value = line.getIn(field)
  return (
    <semantic.Table.Cell
      selectable={!!editing}
      className={className}
    >
      {(() => {
        if (!editing) {
          return value
        }
        return (
          <a onClick={() => store.dispatch(actions.edit([id, field]))}>
            {(() => {
              if (editingThis(editing, id, field)) {
                return (
                  <EditInput
                    onChange={setField(id, field)}
                    value={value}
                    type={type}
                  />
                )
              }
              return value
            })()}
          </a>
        )
      })()}
    </semantic.Table.Cell>
  )
}

function Row({editing, line, maxMpns}) {
  const iLine = immutable.fromJS(line)
  return (
    <tr key={line.id}>
      <EditableCell editing={editing} line={iLine} field={['reference']}/>
      <EditableCell editing={editing} line={iLine} field={['quantity']}/>
      {(() => {
        const ps = line.partNumbers.map((mpn, i) => {
          return [
              <EditableCell
                key={`${line.id}-${mpn.manufacturer}`}
                editing={editing}
                line={iLine}
                field={['partNumbers', i, 'manufacturer']}
              />
           ,
             <EditableCell
               key={`${line.id}-${mpn.part}`}
               editing={editing}
               line={iLine}
               field={['partNumbers', i, 'part']}
            />
          ]
        })
        while (ps.length < maxMpns) {
          ps.push([<td />, <td />])
        }
        return ps
      })()}
      {oneClickBom.lineData.retailer_list.map(name => {
        return (
          <EditableCell
            key={`${line.id}-${name}`}
            editing={editing}
            line={iLine}
            field={['retailers', name]}
          />
        )
      })}
    </tr>
  )
}

function markerColor(ref) {
  if (/^C\d/.test(ref)) {
    return 'orange'
  }
  if (/^R\d/.test(ref)) {
    return 'lightblue'
  }
  if (/^IC\d/.test(ref) || /^U\d/.test(ref)) {
    return 'blue'
  }
  if (/^L\d/.test(ref)) {
    return 'black'
  }
  if (/^D\d/.test(ref)) {
    return 'green'
  }
  if (/^LED\d/.test(ref)) {
    return 'yellow'
  }
  return 'purple'
}



export default Bom
