const mongoose =require('mongoose');
const userSchema =mongoose.Schema({
    fullName:{
        type: String,
        required: true,
    },
    email:{
        type: String,
        required: true,
        unique: true,
    },
    password:{
        type:String,
        required:true,
    },
    Token:{
        type:String,       
    }
   
})
const Users = mongoose.model('User', userSchema);

module.exports = Users;