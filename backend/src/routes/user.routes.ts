import { Router } from 'express';
import { getUser, listUsers, updateAvatar, updateMe, uploadAvatar } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
export const userRouter = Router();
userRouter.get('/', listUsers);
userRouter.get('/search', listUsers);
userRouter.patch('/me', authenticate, updateMe);
userRouter.post('/me/avatar', authenticate, uploadAvatar, updateAvatar);
userRouter.get('/:id', getUser);
