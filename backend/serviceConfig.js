// Centralized configuration for services, prices, and costs.
// This can be fetched by the frontend to ensure consistency.

const serviceConfig = {
    instagram: {
        title: "Instagram",
        options: [
            { name: "Followers", price: 0.4, icon: "people-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.05, icon: "heart-outline", min: 100, max: 100000 },
            { name: "Views", price: 0.01, icon: "eye-outline", min: 100, max: 1000000 },
            { name: "Comments", price: 0.5, icon: "chatbubble-outline", min: 50, max: 50000 },
            { name: "Reel Repost", price: 0.3, icon: "repeat-outline", min: 10, max: 1000 },
            { name: "Reel Save", price: 0.1, icon: "bookmark-outline", min: 10, max: 100000 },
            { name: "Reel Share", price: 0.2, icon: "share-social-outline", min: 10, max: 100000 },
            { name: "Story Views", price: 0.05, icon: "aperture-outline", min: 100, max: 10000 }
        ]
    },
    youtube: {
        title: "YouTube",
        options: [
            { name: "Subscribers", price: 4.0, icon: "person-add-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.2, icon: "thumbs-up-outline", min: 50, max: 10000 },
            { name: "Views", price: 0.7, icon: "play-circle-outline", min: 100, max: 100000 },
            { name: "Comment Likes", price: 0.030, icon: "heart-circle-outline", min: 100, max: 100000 },
            { name: "Comments (Coming Soon)", price: 3.00, icon: "chatbubbles-outline", disabled: true },
            { name: "Watch Time (Coming Soon)", price: 4.00, icon: "time-outline", disabled: true },
        ]
    },
    facebook: {
        title: "Facebook",
        options: [
            { name: "Followers", price: 0.4, icon: "people-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.1, icon: "thumbs-up-outline", min: 50, max: 100000 },
            { name: "Video Views", price: 0.04, icon: "videocam-outline", min: 100, max: 100000 }
        ]
    },
    telegram: {
        title: "Telegram",
        options: [
            { name: "Members", price: 0.3, icon: "people-outline", min: 10, max: 100000 },
            { name: "Views", price: 0.02, icon: "eye-outline", min: 50, max: 100000 },
            { name: "Post Share", price: 0.02, icon: "share-social-outline", min: 50, max: 100000 },
            { name: "Comments", price: 0.6, icon: "chatbubbles-outline", min: 50, max: 10000 }
        ]
    }
};

// Cost prices for profit calculation (from firebase-init.js)
const costPrices = {
    'Instagram': {
        'Followers': 0.108,
        'Likes': 0.0139,
        'Views': 0.0003,
        'Comments': 0.18432,
        'Reel Repost': 0.072,
        'Reel Save': 0.011,
        'Reel Share': 0.03,
        'Story Views': 0.0168
    },
    'YouTube': {
        'Subscribers': 1.74629,
        'Likes': 0.06887,
        'Views': 0.33878,
        'Comment Likes': 0.0165
    },
    'Facebook': {
        'Followers': 0.107,
        'Likes': 0.0354,
        'Video Views': 0.0138
    },
    'Telegram': {
        'Members': 0.058,
        'Views': 0.0088,
        'Post Share': 0.007,
        'Comments': 0.262
    }
};


module.exports = { serviceConfig, costPrices };