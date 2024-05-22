const mongoose =require('mongoose');
const conversationSchema =mongoose.Schema({
    _conversationId: {
        type: String,  
        required: true
      },
    retailerId: {
        type: String,
        ref: 'User',
        required: true
    },
    userId: {
        type: String,
        ref: 'User', 
        required: true
    },   
   
})

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;