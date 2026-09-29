import {Schema,model,models} from 'mongoose';
const UserSchema=new Schema({name:String,email:{type:String,unique:true,required:true,lowercase:true},passwordHash:String,role:{type:String,enum:['customer','admin'],default:'customer'},phone:String,addresses:[Schema.Types.Mixed]},{timestamps:true});
export const UserModel=models.User||model('User',UserSchema);
