const dayjs = require('dayjs')
import { formatResult } from '../utils'
import { FormatResultState, OutputState, QueryResData, RecordsState } from '../type/common'
import { DeleteState, SqlResultState } from '../type/sql'
import Sql from '.'

class SqlOperation {
  // Read
  select = function (column = '*'): Sql {
    this.sql.select = column
    return this
  }

  from = function (table: string): Sql {
    this.sql.from = table
    return this
  }

  limit = function (_limit: string): Sql {
    this.sql.limit = _limit
    return this
  }

  where = function (condition = ''): Sql {
    this.sql.where = condition
    return this
  }

  groupBy = function (condition = ''): Sql {
    this.sql.groupBy = condition
    return this
  }

  orderBy = function (condition = '', order = 'ASC'): Sql {
    this.sql.orderBy = condition ? `${condition} ${order}` : ''
    return this
  }

  duration = function (timeIndex = '', t = '5m'): Sql {
    const [time, unit] = t.split(/(?<=\d)(?=[a-zA-Z])/)
    this.sql.where += `${this.sql.where ? 'AND' : ''} ${timeIndex} > ${dayjs()
      .subtract(time, unit)
      .valueOf()}000000::Timestamp`
    return this
  }

  today = function (timeIndex: number): Sql {
    this.sql.where += `${this.sql.where ? 'AND' : ''} ${timeIndex} > ${dayjs().startOf('d').valueOf()}000000::Timestamp`
    return this
  }

  query = async function (): Promise<SqlResultState> {
    const sql = `SELECT ${this.sql.select} 
      FROM ${this.sql.from} 
      ${this.sql.where ? `WHERE ${this.sql.where}` : ''} 
      ${this.sql.groupBy ? `GROUP BY ${this.sql.groupBy}` : ''} 
      ${this.sql.orderBy ? `ORDER BY ${this.sql.orderBy}` : ''} 
      ${this.sql.limit ? `LIMIT ${this.sql.limit}` : ''}`.replace(/\s+/g, ' ')

    let res: QueryResData = await this.runSQL(sql)

    return {
      ...(<FormatResultState>formatResult(res)),
      sql,
    }
  }

  count = async function (): Promise<number> {
    const sql = `SELECT COUNT(1) 
      FROM ${this.sql.from} 
      ${this.sql.where ? `WHERE ${this.sql.where}` : ''} 
      ${this.sql.groupBy ? `GROUP BY ${this.sql.groupBy}` : ''} 
      ${this.sql.orderBy ? `ORDER BY ${this.sql.orderBy}` : ''} 
      ${this.sql.limit ? `LIMIT ${this.sql.limit}` : ''}`.replace(/\s+/g, ' ')

    let res: QueryResData = await this.runSQL(sql)

    return <number>formatResult(res, 'one')
  }

  // Info
  tableDesc = async function (table: string): Promise<FormatResultState> {
    let res: QueryResData = await this.runSQL(`DESC TABLE ${table}`)

    return <FormatResultState>formatResult(res)
  }

  getTimeIndex = async function (table: string): Promise<number> {
    let res: RecordsState = await this.tableDesc(table)
    return <number>res.rows.find((row) => row[4] === 'TIME INDEX')[0]
  }

  // Write
  createTable = async function (name, { tags, fileds, timeIndex }): Promise<OutputState> {
    const sql = `CREATE TABLE IF NOT EXISTS ${name} (
      ${timeIndex} TIMESTAMP TIME INDEX,
      ${tags.map((tag) => `"${tag}" String`)},
      PRIMARY KEY (${tags.join(',\n')}),
      ${fileds
        .map((filed) => {
          if (typeof filed === 'string') {
            return `"${filed}" DOUBLE`
          } else {
            return Object.entries(filed)
              .map(([key, value]) => `"${key}" ${value}`)
              .join(',\n')
          }
        })
        .join(',\n')}
    )`

    let res: QueryResData = await this.runSQL(sql)

    return <OutputState>formatResult(res, '')
  }

  insert = async function (table: string, values: Array<Array<number | string>>): Promise<OutputState> {
    const valuesStr = `${values
      .map((value) => {
        return `(${value.map((item) => (typeof item === 'string' ? `"${item}"` : item)).join(',')})`
      })
      .join(',\n')};`
    const sql = `INSERT INTO ${table} VALUES ${valuesStr}`
    const res = await this.runSQL(sql)

    return <OutputState>formatResult(res, '')
  }

  delete = async function (table: string, condition: DeleteState): Promise<OutputState> {
    const sql = `DELETE FROM ${table} WHERE ${Object.entries(condition.primary)
      .map(([key, value]) => `${key}='${value}'`)
      .join(' and ')} and ts=${condition.timestamp};`

    const res = await this.runSQL(sql)

    return <OutputState>formatResult(res, '')
  }
}

export default SqlOperation
