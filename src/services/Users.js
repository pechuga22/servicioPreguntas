const { Client, connectionData} = require('../lib/database');
const { ROLE_ASESOR, STATUS} = require('../utils/constants');
const { encryptPassword, matchPassword} = require('../middleware/encrypt_pass');
const { secret_key } = require('../config/environments');
const jwt = require('jsonwebtoken');
const {isValidEmail} = require('../controllers/helpers');


class Users {

    constructor(){
        this.connectionString = `postgres://${connectionData.user}:${connectionData.password}@${connectionData.host}:${connectionData.port}/${connectionData.database}`
    }

    async connect(query, values) {
        return new Promise((resolve, reject) => {
          try {
            const client = new Client(this.connectionString);
            client.connect();
            client.query(query, values && values.length > 0 && values, function(err, result) {
              client.end();
              if (err) return reject(err);
              resolve(result);
            });
          } catch (err) {

            reject(err);
          }
        });
      }
     
      async registerAdmin (email,password) {
        try{
          if(!email  || !password){
            return {message: "Enter your email and password"}
          }
          if(!isValidEmail(email)){
              return {message:'Please enter a valid email address'}
          }
            const queryBuscar = 'select * from store where email = $1'
            let resultBuscar = await this.connect(queryBuscar, [email])
            if (resultBuscar.rows.length > 0){
              return { message: 'Email already exists'}
            } else {
                const hash = await encryptPassword(password)
                const query = 'insert into store(storeid, name, nit, email, password, phone, address, roleid) values($1, $2, $3, $4, $5, $6, $7, $8)'
                let result = await this.connect(query, [1,'spiceStock', 122121212, email, hash, 1234567, 83434,ROLE_ASESOR,])
                return {message:'Store has been register', data:result.rows}
            }  
          } catch(err){
              console.log(err);
          }
      }
//login
      async loginAdmin (email,password){
        try{
          if(!email  || !password){
            return {message: "Enter your email and password"}
          }
          if(!isValidEmail(email)){
            return {message:'Please enter a valid email address'}
        }
          let userDB 
          const query = 'select storeid, roleid,email,password from store where email = $1'
          let result = await this.connect(query, [email])
    
          if(result.rows.length > 0){
            userDB = result.rows[0];
            const match = await matchPassword(password, userDB.password);
            if(match){
              const token  =  await jwt.sign({userid:userDB.userid, email:userDB.email}, secret_key)
              return {message: 'Your token',token,error: false}
            } else {
              return {message: 'Incorrect password', error: true}
            }
          } else {
            return {message: 'Store not exists',error: true}
          }     
        } catch(err){
          console.log(err)
        }
      }
//Listado de las preguntas
      async getOpenQuestions (){
        try{
          const query = `select q.questionid, u.userid,u.name ,q.content, q.status, q.productid, p.title ,q.createdsince from questions as q
          inner join users as u
          on u.userid  = q.userid
          inner join products as p 
          on p.productid = q.productid
          where q.status = 1`
          const result = await this.connect(query);
          return result.rows
        }catch(err){
          console.log(err);
        }
      }
//cancela las preguntas
      async deleteQuestions (questionid){
        try{
          if(questionid){
            const query = 'update questions set status = 0 where status=1 and questionid = $1'
            await this.connect(query, [questionid]);
            return {message:"Question has been delete... (change state to cancel)"}
          } else{
            return {message: "Error to delete the question"};
          }
        } catch(err){
          console.log(err)
        }
      }
//esto es para el panel product detail crea la pregunta
      async createQuestion(userid,content, productid) {
        try{
          if(!content){
            return {message: "The question should have content"}
          }
          const query = 'insert into questions(userid, productid, content , status ) values($1, $2, $3, $4)'
          await this.connect(query, [userid,productid, content,STATUS.OPEN]);
          return {message: 'Question has been created'}
        } catch(err){
        console.log(err)
        }
      }
//crea la respuesta desde el modulo gestion
      async createAnswer(answer, questionid){
        try {
          if(!answer){
            return {message: 'The response should have content'}
          }
            const query = 'update questions set answer = $1 , status = 2 where questionid = $2'
            await this.connect(query, [answer, questionid])
            return {message: 'The answer has been saved'}
         } 
        catch (err) {
          console.log(err)
      }
    }
//esto es para el panel de user
    async get_questions_by_productid(productid){
      try{
          const query = `select u.userid, u.name, q.createdsince, q.content from questions as q
                         inner join users as u 
                         on u.userid  = q.userid 
                         where productid = $1`
          const result = await this.connect(query, [productid]);
          return result.rows              
      } catch(err){
        console.log(err);
      }
    }
//Imprime reporte en excel
    async report(){
      try{
        const query = `select q.questionid, u.userid,u.name ,q.content, q.status, q.productid, p.title ,q.createdsince from questions as q
        inner join users as u
        on u.userid  = q.userid
        inner join products as p 
        on p.productid = q.productid
        where q.status = 2 `

        const result = await this.connect(query);
        return result.rows
      } catch(err){
        console.log(err);
      }
    }
    //selecciona las categorias padre
    async get_categories(){
      try{
        const query = `select categoryid, name  from categories c  where parentid isnull and categoryid != 50689`
        const categories = await this.connect(query);
        return categories.rows
      } catch (err){
        console.log(err);
      }
    }
    //Obtiene l;as categorias hijas
    async get_children_categories(id){
      try{
        const query = `SELECT categoryid, fullname,parentid, status  FROM categories where parentid = $1`
        const result = await this.connect(query, [id]);
        return result.rows
      } catch(err){
        console.log(err);
      }
    }
    //Crea los productos
    async create_product(categoryid,storeid,title, description,asin,usd,price,stock,weight,height,length,width,status,createdsince){
      try{
        const query = `insert into products (categoryid, title, description,asin, usd, price, stock, weight, height, length, width,status, storeid,createdsince)
                       values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
        await this.connect(query, [categoryid, title, description,asin, usd, price, stock, weight, height, length, width,status, storeid,createdsince])
        return {message: 'product has been created'}
      } catch(err){
        console.log(err)
        }
    }

    //Lista los productos creados en la tabla
    async get_products(storeid){
      try{
        const query = `select categoryid, title, description,asin, usd, price, stock, weight, height, length, width,status, storeid,createdsince from products where storeid = $1`
        const result = this.connect(query, [storeid])
        return result.rows
      } catch (err){
        console.log(err);
      }
    }
    // async get_children_categories(id){
    //   try{
    //     const query = `select * from categories where parentid = $1`
    //     const result = await this.connect(query, [id])
    //     data_children = []
    //     for (let i = 0; i < result.length; i++) {
    //        __json = {
    //          'id': i[0],
    //          'name': i[1]
    //        }
    //        data_children.push(__json)
    //     }
    //     return data_children
    //   } catch(err){
    //     console.log(err);
    //   }
    // }
  }


module.exports = new Users();