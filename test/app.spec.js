const app = require('../src/app')
const knex = require('knex')
const { makeBookmarksArray, makeMaliciousBookmark } = require('./bookmarks-fixtures')

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
                .get('/api/bookmarks/')
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
                    .get('/api/bookmarks/')
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(200, testBookmarks)
            })
        })
        context(`Given an XSS attack article`, () => {
            const {maliciousBookmark, expectedBookmark} = makeMaliciousBookmark()

            beforeEach('insert malicious bookmark', () => {
                return db
                    .into('bookmarks')
                    .insert( [maliciousBookmark])
            })
            it(`removes XSS attack content`, () => {
                return supertest(app)
                    .get('/api/bookmarks/')
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(200)
                    .expect(res => {
                        expect(res.body[0].title).to.eql(expectedBookmark.title)
                        expect(res.body[0].description).to.eql(expectedBookmark.description)
                    })
            })
        })
    })
    describe(`GET 'bookmarks/:id`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds 404`, () => {
                const testId = 1234567
                return supertest(app)
                    .get(`/api/bookmarks/${testId}`)
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
                    .get(`/api/bookmarks/${testId}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(200, expectedBookmark)
            })
        })
    })
    describe(`POST /bookmarks`, () => {
        it(`creates a bookmark, responding with a 201 and the new bookmark`, () => {
            const newBookmark = {
                    title: 'new BM',
                    url: 'https://overview.thinkful.com/programs/web-development-flexible',
                    description: 'Just Thinkful',
                    rating: "5.0"
                }
            return supertest(app)
                .post('/api/bookmarks')
                .send(newBookmark)
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(201)
                .expect(res => {
                    expect(res.body.title).to.eql(newBookmark.title)
                    expect(res.body.url).to.eql(newBookmark.url)
                    expect(res.body.description).to.eql(newBookmark.description)
                    expect(res.body.rating).to.equal(newBookmark.rating)
                    expect(res.headers.location).to.eql(`/api/bookmarks/${res.body.id}`)
                })
                .then(postRes =>
                    supertest(app)
                        .get(`/api/bookmarks/${postRes.body.id}`)
                        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                        .expect(postRes.body)
                    )
        })
        const requiredFields = ['title', 'url', 'description', 'rating']
        
        requiredFields.forEach(field => {
            const newBookmark = {
                title: 'new BM',
                url: 'https://overview.thinkful.com/programs/web-development-flexible',
                description: 'Just Thinkful',
                rating: "5.0"
            }
            it(`responds with 400 when ${field} is missing`, () => {
                delete newBookmark[field]

                return supertest(app)
                    .post('/api/bookmarks/')
                    .send(newBookmark)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(400)
            })
        })
    })
    describe(`DELETE /bookmarks/:bookmark:id`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds with 404 and an error`, () => {
                const bookmarkId = 123456
                return supertest(app)
                    .delete(`/api/bookmarks/${bookmarkId}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(404, {error: {message: 'Bookmark not found'}})
            })
        })
        context(`Given that there are bookmarks in the db`, () =>{
            const testBookmarks = makeBookmarksArray()

            beforeEach('insert bookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })
            it(`Rsponds with 204 and removes the bookmark`, () => {
                const idToRemove = 2
                const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove)

                return supertest(app)
                    .delete(`/api/bookmarks/${idToRemove}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(204)
                    .then(res => 
                        supertest(app)
                            .get(`/api/bookmarks/`)
                            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                            .expect(expectedBookmarks)
                    )
            })
        })

    })
    describe(`PATCH /api/bookmarks/:bookmark_id`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds with 404`, () => {
                const bookmarkId = 123456
                return supertest(app)
                    .patch(`/api/bookmarks/${bookmarkId}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .expect(404, {error: {message: 'Bookmark not found'}})
            })
        })
        context(`Given there are bookmarks in the db`, () => {
            const testBookmarks = makeBookmarksArray()

            beforeEach(`insert into bookmarks`, () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })
            it(`responds with 204 and updates the bookmark`, () => {
                const idToUpdate = 2
                const updateBookmark = {
                    title: 'update BM',
                    url: 'https://overview.thinkful.com/programs/web-development-flexible',
                    description: 'Updated Thinkful',
                    rating: "4.1"
                }
                const expectedBookmark = {
                    ...testBookmarks[idToUpdate -1],
                    ...updateBookmark
                }
                return supertest(app)
                    .patch(`/api/bookmarks/${idToUpdate}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .send({
                        ...updateBookmark
                        })
                    .expect(204)
                    .then(res => 
                        supertest(app)
                            .get(`/api/bookmarks/${idToUpdate}`)
                            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                            .expect(expectedBookmark)
                    )
            })
            it(`responds 400 when no required fields are supplied`, () => {
                const idToUpdate = 2
                return supertest(app)
                    .patch(`/api/bookmarks/${idToUpdate}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .send({irrelevantField: 'foo'})
                    .expect(400, {
                        error: {message: `Request body must contain either 'title', 'url', 'description', or 'rating'`}
                    })
            })
            it(`Responds 204 when updating only a subset of the fields`, () => {
                const idToUpdate = 2
                const updateBookmark = {
                    title: 'UPDATE WORKS'
                }
                const expectedBookmark = {
                    ...testBookmarks[idToUpdate -1],
                    ...updateBookmark
                }
                return supertest(app)
                    .patch(`/api/bookmarks/${idToUpdate}`)
                    .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                    .send({
                        ...updateBookmark,
                         fieldToIgnore: 'should not be in response'
                        })
                    .expect(204)
                    .then(res => 
                        supertest(app)
                            .get(`/api/bookmarks/${idToUpdate}`)
                            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                            .expect(expectedBookmark)
                    )
            })
        })
    })
})