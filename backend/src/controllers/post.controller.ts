import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

import { prisma } from '../config/prisma.js';

import { AppError } from '../utils/app-error.js';

import { asyncHandler } from '../utils/async-handler.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const postMediaDirectory = path.join(backendRoot, 'uploads', 'posts');
fs.mkdirSync(postMediaDirectory, { recursive: true });
const allowedPostMedia = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp']]);
const postMediaStorage = multer.diskStorage({
  destination: postMediaDirectory,
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${allowedPostMedia.get(file.mimetype) || ''}`)
});
export const uploadPostMedia = multer({
  storage: postMediaStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedPostMedia.has(file.mimetype))
}).single('image');

export const savePostMedia: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'INVALID_MEDIA', 'Choose a JPEG, PNG, or WebP image up to 8 MB.');
  const header = Buffer.alloc(12);
  const handle = await fs.promises.open(req.file.path, 'r');
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  const valid = (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)
    || header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    || (header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP');
  if (!valid) {
    await fs.promises.unlink(req.file.path);
    throw new AppError(400, 'INVALID_MEDIA', 'The uploaded file is not a valid JPEG, PNG, or WebP image.');
  }
  res.status(201).json({ success: true, data: { url: `/uploads/posts/${req.file.filename}` } });
});


/* ============================================================
   SHARED INCLUDE
   Used by existing post APIs.
   ============================================================ */

const include = {
  author: {
    select: {
      id: true,
      fullName: true,
      avatar: true
    }
  },

  community: {
    select: {
      id: true,
      name: true
    }
  },

  _count: {
    select: {
      likes: true,
      comments: true
    }
  }
} as const;


/* ============================================================
   EXISTING GENERIC POST LIST
   Keep behaviour intact for current features.
   ============================================================ */

export const listPosts: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );


      const limit =
        Math.min(
          50,
          Math.max(
            1,
            Number(req.query.limit) || 20
          )
        );


      const [data, total] =
        await prisma.$transaction([

          prisma.post.findMany({

            skip:
              (page - 1) * limit,

            take:
              limit,

            orderBy: {
              createdAt: 'desc'
            },

            include
          }),


          prisma.post.count()

        ]);


      res.json({

        success: true,

        data,

        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(
              total / limit
            )
        }

      });

    }
  );


/* ============================================================
   CAMPUSSPHERE SOCIAL FEED
   Only posts where communityId === null.
   ============================================================ */
export const userPosts: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const userId =
        String(
          req.params.userId
        );


      const data =
        await prisma.post.findMany({

          where: {

            authorId:
              userId,

            communityId:
              null

          },

          orderBy: {
            createdAt: 'desc'
          },

          take: 30,

          include: {

            _count: {

              select: {

                likes: true,

                comments: true

              }

            }

          }

        });


      res.json({

        success: true,

        data

      });

    }
  );

export const socialFeed: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const userId =
        req.auth!.sub;


      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );


      const limit =
        Math.min(
          30,
          Math.max(
            1,
            Number(req.query.limit) || 10
          )
        );


      const where = {
        communityId: null
      };


      const [posts, total] =
        await prisma.$transaction([

          prisma.post.findMany({

            where,

            skip:
              (page - 1) * limit,

            take:
              limit,

            orderBy: {
              createdAt: 'desc'
            },

            include: {

              author: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: true,
                  bio: true,
                  college: true,
                  course: true,
                  year: true,
                  role: true
                }
              },

              likes: {
                where: {
                  userId
                },

                select: {
                  userId: true
                }
              },

              _count: {
                select: {
                  likes: true,
                  comments: true
                }
              }

            }

          }),


          prisma.post.count({
            where
          })

        ]);


      const data =
        posts.map(
          post => ({

            id:
              post.id,

            content:
              post.content,

            image:
              post.image,

            createdAt:
              post.createdAt,

            updatedAt:
              post.updatedAt,

            author:
              post.author,

            likeCount:
              post._count.likes,

            commentCount:
              post._count.comments,

            likedByMe:
              post.likes.length > 0,

            isMine:
              post.authorId === userId

          })
        );


 res.json({
  success: true,

  data: {
    items: data,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    }
  }
});

    }
  );


/* ============================================================
   CREATE POST
   No communityId = global CampusSphere social post.
   ============================================================ */

export const createPost: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const {
        content,
        image,
        communityId
      } =
        req.body as {
          content?: string;
          image?: string;
          communityId?: string;
        };


  const cleanContent =
  content?.trim() || '';

const cleanImage =
  typeof image === 'string' &&
  image.trim()
    ? image.trim()
    : null;


if (
  !cleanContent &&
  !cleanImage
) {

  throw new AppError(
    400,
    'VALIDATION_ERROR',
    'Add text or an image before posting.'
  );

}

      if (
        cleanContent.length > 5000
      ) {

        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Post content is too long.'
        );

      }


      /*
       * Community posting permissions
       */

      if (communityId) {

        const membership =
          await prisma.communityMember
            .findUnique({

              where: {

                communityId_userId: {
                  communityId,
                  userId:
                    req.auth!.sub
                }

              }

            });


        if (!membership) {

          throw new AppError(
            403,
            'FORBIDDEN',
            'Join the community before posting.'
          );

        }

      }


      const data =
        await prisma.post.create({

          data: {

            content:
              cleanContent,

            image:
              cleanImage,

            communityId:
              communityId || null,

            /*
             * SECURITY:
             * authorId always comes from the
             * authenticated session.
             */
            authorId:
              req.auth!.sub

          },

          include

        });


      res
        .status(201)
        .json({
          success: true,
          data
        });

    }
  );


/* ============================================================
   DELETE OWN POST
   ============================================================ */

export const deletePost: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const postId =
        String(
          req.params.id
        );


      const post =
        await prisma.post.findUnique({

          where: {
            id: postId
          },

          select: {
            id: true,
            authorId: true
          }

        });


      if (!post) {

        throw new AppError(
          404,
          'NOT_FOUND',
          'Post not found.'
        );

      }


      if (
        post.authorId !==
        req.auth!.sub
      ) {

        throw new AppError(
          403,
          'FORBIDDEN',
          'You can only delete your own posts.'
        );

      }


      await prisma.post.delete({

        where: {
          id: postId
        }

      });


      res
        .status(204)
        .send();

    }
  );


/* ============================================================
   LIKE
   ============================================================ */

export const likePost: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const postId =
        String(
          req.params.id
        );


      /*
       * Ensure the post exists first,
       * giving a clean 404 instead of
       * leaking a Prisma FK error.
       */

      const exists =
        await prisma.post.findUnique({

          where: {
            id: postId
          },

          select: {
            id: true
          }

        });


      if (!exists) {

        throw new AppError(
          404,
          'NOT_FOUND',
          'Post not found.'
        );

      }


      await prisma.postLike.upsert({

        where: {

          postId_userId: {

            postId,

            userId:
              req.auth!.sub

          }

        },

        update: {},

        create: {

          postId,

          userId:
            req.auth!.sub

        }

      });


      res
        .status(204)
        .send();

    }
  );


/* ============================================================
   UNLIKE
   Idempotent: unliking twice should not crash.
   ============================================================ */

export const unlikePost: RequestHandler =
  asyncHandler(
    async (req, res) => {

      await prisma.postLike.deleteMany({

        where: {

          postId:
            String(
              req.params.id
            ),

          userId:
            req.auth!.sub

        }

      });


      res
        .status(204)
        .send();

    }
  );


/* ============================================================
   CREATE COMMENT
   ============================================================ */

export const comment: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const postId =
        String(
          req.params.id
        );


      const content =
        String(
          req.body.content || ''
        ).trim();


      if (!content) {

        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Comment content is required.'
        );

      }


      if (
        content.length > 2000
      ) {

        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Comment is too long.'
        );

      }


      const exists =
        await prisma.post.findUnique({

          where: {
            id: postId
          },

          select: {
            id: true
          }

        });


      if (!exists) {

        throw new AppError(
          404,
          'NOT_FOUND',
          'Post not found.'
        );

      }


      const data =
        await prisma.comment.create({

          data: {

            postId,

            authorId:
              req.auth!.sub,

            content

          },

          include: {

            author: {

              select: {

                id: true,

                fullName: true,

                avatar: true

              }

            }

          }

        });


      res
        .status(201)
        .json({

          success: true,

          data

        });

    }
  );


/* ============================================================
   LIST COMMENTS
   ============================================================ */

export const comments: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const data =
        await prisma.comment.findMany({

          where: {

            postId:
              String(
                req.params.id
              )

          },

          orderBy: {
            createdAt: 'asc'
          },

          include: {

            author: {

              select: {

                id: true,

                fullName: true,

                avatar: true

              }

            }

          }

        });


      res.json({

        success: true,

        data

      });

    }
  );


/* ============================================================
   DELETE OWN COMMENT
   ============================================================ */

export const deleteComment: RequestHandler =
  asyncHandler(
    async (req, res) => {

      const commentId =
        String(
          req.params.commentId
        );


      const existing =
        await prisma.comment.findUnique({

          where: {
            id: commentId
          },

          select: {

            id: true,

            authorId: true

          }

        });


      if (!existing) {

        throw new AppError(
          404,
          'NOT_FOUND',
          'Comment not found.'
        );

      }


      if (
        existing.authorId !==
        req.auth!.sub
      ) {

        throw new AppError(
          403,
          'FORBIDDEN',
          'You can only delete your own comments.'
        );

      }


      await prisma.comment.delete({

        where: {
          id: commentId
        }

      });


      res
        .status(204)
        .send();

    }
  );
