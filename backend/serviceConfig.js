// Centralized configuration for services, prices, and costs.
// This can be fetched by the frontend to ensure consistency.

const serviceConfig = {
    instagram: {
        title: "Instagram",
        options: [
            { name: "Followers", price: 0.40, icon: "people-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.05, icon: "heart-outline", min: 10, max: 100000 },
            { name: "Views", price: 0.008, icon: "eye-outline", min: 100, max: 1000000 },
            { name: "Comments", price: 0.2, icon: "chatbubble-outline", min: 50, max: 50000 },
            { name: "Reel Repost", price: 0.2, icon: "repeat-outline", min: 10, max: 1000 },
            { name: "Reel Share", price: 0.02, icon: "share-social-outline", min: 100, max: 100000 },
            { name: "Story Views", price: 0.04, icon: "aperture-outline", min: 10, max: 10000 }
        ]
    },
    youtube: {
        title: "YouTube",
        options: [
            { name: "Subscribers", price: 4.40, icon: "person-add-outline", min: 50, max: 10000 },
            { name: "Likes", price: 0.3, icon: "thumbs-up-outline", min: 10, max: 10000 },
            { name: "Views", price: 0.40, icon: "play-circle-outline", min: 100, max: 100000 },
            { name: "Comment Likes", price: 0.030, icon: "heart-circle-outline", min: 100, max: 100000 },
            { name: "Comments (Coming Soon)", price: 3.00, icon: "chatbubbles-outline", disabled: true },
            { name: "Watch Time (Coming Soon)", price: 4.00, icon: "time-outline", disabled: true },
        ]
    }
};

// Cost prices for profit calculation (from firebase-init.js)
const costPrices = {
    'Instagram': {
        'Followers': 0.13,
        'Likes': 0.02,
        'Views': 0.004,
        'Comments': 0.2,
        'Reel Repost': 0.07,
        'Reel Share': 0.003,
        'Story Views': 0.02
    },
    'YouTube': {
        'Subscribers': 2.8,
        'Likes': 0.06,
        'Views': 0.33,
        'Comment Likes': 0.0165
    }
};


module.exports = { serviceConfig, costPrices };