Required server environment variables:

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
NODE_ENV=production
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

Local development:

PORT=5000
NODE_ENV=development

Important:
Do not commit real database passwords, JWT secrets, or Cloudinary secrets to GitHub.
Add them in Vercel Project Settings > Environment Variables instead.
