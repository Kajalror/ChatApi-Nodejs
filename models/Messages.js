const mongoose =require('mongoose');
const messageSchema =mongoose.Schema({
    _conversationId:{
        type: String,
    },
    userId:{
        type : String,
    },
    message: {
        type: String,
    },      
});

const Messages = mongoose.model('Message', messageSchema);
module.exports = Messages;
