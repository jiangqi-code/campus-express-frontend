const weights=[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]
const checks=['1','0','X','9','8','7','6','5','4','3','2']
export function parseIdCard(raw:string){
  const idCard=String(raw||'').trim().toUpperCase()
  if(!/^\d{17}[\dX]$/.test(idCard))return {isValid:false,birthDate:'',gender:''}
  const expected=checks[idCard.slice(0,17).split('').reduce((sum,n,i)=>sum+Number(n)*weights[i],0)%11]
  const birth=idCard.slice(6,14),birthDate=`${birth.slice(0,4)}-${birth.slice(4,6)}-${birth.slice(6,8)}`,date=new Date(`${birthDate}T00:00:00`)
  const isValid=expected===idCard[17]&&Number.isFinite(date.getTime())&&date.getFullYear()===Number(birth.slice(0,4))&&date.getMonth()+1===Number(birth.slice(4,6))&&date.getDate()===Number(birth.slice(6,8))
  return {isValid,birthDate:isValid?birthDate:'',gender:isValid?(Number(idCard[16])%2?'MALE':'FEMALE'):''}
}
