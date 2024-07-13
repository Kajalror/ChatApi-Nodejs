const mongoose =require('mongoose');
const messageSchema =mongoose.Schema({
    _conversationId:{
        type: String,
        required: true
    },
    userId:{
        type : String,
        required: true
    },
    retailerId: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }, 
    date: {
        type: Date,
        default: Date.now
    } 
});

const Messages = mongoose.model('Message', messageSchema);
module.exports = Messages;
