import mongoose,{Schema,model,models} from 'mongoose';
const ProductSchema=new Schema({
  _id:{type:String}, name:{type:String,required:true}, fit:{type:String,enum:['oversized','regular','fullsleeve','crop','kids'],required:true},
  cat:{type:String,enum:['graphic','plain','custom'],required:true}, price:{type:Number,required:true}, was:Number, gsm:{type:Number,required:true}, method:{type:String,required:true},
  colors:{type:[String],required:true}, images:{type:[{url:String,publicId:String,alt:String}],default:[]}, customColors:{type:Map,of:String}, print:String, tag:String, desc:{type:String,required:true},
  sizes:{type:Map,of:Number,default:{}}, active:{type:Boolean,default:true}, imageUrl:String, order:{type:Number,default:0}
},{timestamps:true});
export const ProductModel=models.Product||model('Product',ProductSchema);
