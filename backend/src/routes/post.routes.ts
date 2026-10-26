import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';

import * as p from '../controllers/post.controller.js';


export const postRouter = Router();


/*
 * Existing generic/community post listing.
 * Keep this route for current CampusSphere features.
 */
postRouter.get('/', p.listPosts);


/*
 * CampusSphere Social Network feed.
 * Authentication is required because the response includes
 * likedByMe and isMine.
 */
postRouter.get(
  '/feed',
  authenticate,
  p.socialFeed
);
postRouter.get(
  '/user/:userId',
  authenticate,
  p.userPosts
);

postRouter.post('/media', authenticate, p.uploadPostMedia, p.savePostMedia);

/*
 * Create post.
 *
 * communityId supplied   -> Community post
 * no communityId         -> Campus social post
 */
postRouter.post(
  '/',
  authenticate,
  p.createPost
);


/*
 * Post ownership
 */
postRouter.delete(
  '/:id',
  authenticate,
  p.deletePost
);


/*
 * Likes
 */
postRouter.post(
  '/:id/like',
  authenticate,
  p.likePost
);

postRouter.delete(
  '/:id/like',
  authenticate,
  p.unlikePost
);


/*
 * Comments
 */
postRouter.get(
  '/:id/comments',
  p.comments
);

postRouter.post(
  '/:id/comments',
  authenticate,
  p.comment
);

postRouter.delete(
  '/comments/:commentId',
  authenticate,
  p.deleteComment
);
