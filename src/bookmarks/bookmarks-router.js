const express = require('express')
const uuid = require('uuid/v4')
const logger = require('../logger')
const {bookmarks} =require('../store')
const BookmarksService = require('./bookmarks-service')
const xss = require('xss')
const bookmarksRouter = express.Router()
const bodyParser = express.json()
const { isWebUri } = require('valid-url')

const serializeBookmark = bookmark =>(
    {
        id: bookmark.id,
        title: xss(bookmark.title),
        url: bookmark.url,
        description: xss(bookmark.description),
        rating: bookmark.rating
    }
)

bookmarksRouter
    .route('/bookmarks')
    .get((req, res, next) => {
        BookmarksService.getAllBookmarks(req.app.get('db'))
            .then(bookmarks => {
                res.json(bookmarks.map(serializeBookmark))
            })
            .catch(next)
    })
    .post(bodyParser, (req, res, next) => {
        const {title, url, description, rating } = req.body;

        if(!title) {
            logger.error(`Title is required`);
            return res 
                .status(400)
                .send('Invalid data');
        }
        if(!url) {
            logger.error(`url is required`);
            return res 
                .status(400)
                .send('Invalid data');
        }
        if(!description) {
            logger.error(`Description is required`);
            return res 
                .status(400)
                .send('Invalid data');
        }
        if(!rating) {
            logger.error(`Rating is required`);
            return res 
                .status(400)
                .send('Invalid data');
        }
        
        //const id = uuid();

        if (Number.isNaN(rating) || rating < 0 || rating > 5) {
            logger.error(`Invalid rating '${rating}' supplied`)
            return res.status(400).send({
              error: { message: `'rating' must be a number between 0 and 5` }
            })
          }
      
          if (!isWebUri(url)) {
            logger.error(`Invalid url '${url}' supplied`)
            return res.status(400).send({
              error: { message: `'url' must be a valid URL` }
            })
          }
        
          const newBookmark = {
            title,
            url,
            description,
            rating
        }

        BookmarksService.insertBookmark(req.app.get('db'), newBookmark)
        .then(bookmark => {
            res
                .status(201)
                .location(`/bookmarks/${bookmark.id}`)
                .json(serializeBookmark(bookmark))
            })
            .then(logger.info(`Bookmark was created`))
            .catch(next)
    })

bookmarksRouter
    .route('/bookmarks/:id')
    .all((req,res,next) => {
        BookmarksService.getById(
            req.app.get('db'),
            req.params.id
        )
        .then(bookmark => {
            if(!bookmark) {
                return res
                    .status(404)
                    .json({
                        error: {message: 'Bookmark not found'}
                    })
            }
            res.bookmark = bookmark
            next()
        })
        .catch(next)
    })
    .get((req, res, next) => {
        res.json(serializeBookmark(res.bookmark))
    })
    .delete((req, res, next) => {
        BookmarksService.deleteBookmark(
            req.app.get('db'),
            req.params.id 
        )
        .then(() => {
            logger.info(`Bookmark with id ${req.params.id} deleted`)
            res.status(204).end()
        })
        .catch(next)
    })
    
    module.exports = bookmarksRouter