const app = require('../src/app')
const knex = require('knex')
const { makeBookmarksArray } = require('./bookmarks-fixtures')

describe('App runs a server', () =>{
    it('GET / responds with 200 containing "Hello, World"', () => {
        return supertest(app)
            .get('/')
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(200, 'Hello, world!')
    })
})
describe(`Bookmarks Endpoints`, function(){
    let db

    before('make knex instance', () => {
      db = knex({
        client: 'pg',
        connection: process.env.TEST_DB_URL,
      })
      app.set('db', db)
    })
    
    after('disconnect from the db', () => db.destroy())
    before('clean the table', () => db('bookmarks').truncate())
    afterEach('cleanup', () => db('bookmarks').truncate())

    describe(`GET /bookmarks`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds with 200 and an empty list`, () => {
              return supertest(app)
                .get('/bookmarks')
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(200, [])
            })
          })
        context(`given that there are bookmarks in the db`, () => {
            const testBookmarks = makeBookmarksArray()
            beforeEach('insert bookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })
            it(`responds 200 with all bookmarks`, () => {
                return supertest(app)
                    .get('/bookmarks')
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(200, testBookmarks)
            })
        } )
    })
    describe(`GET 'bookmarks/:id`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds 404`, () => {
                const testId = 1234567
                return supertest(app)
                    .get(`/bookmarks/${testId}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(404)
            })
        })
        context(`Provided with bookmarks`, () => {
            const testBookmarks = makeBookmarksArray()
            beforeEach('insert bookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })
            it(`returns 200 and the desired bookmark`, () => {
                const testId = 2
                const expectedBookmark = testBookmarks[testId -1]
                return supertest(app)
                    .get(`/bookmarks/${testId}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(200, expectedBookmark)
            })
        })
    })
})