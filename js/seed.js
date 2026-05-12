(function(){
  if(localStorage.getItem('sq_seeded')) return;
  var demo = [
    {id:'demo_1',name:'Aisha K.',email:'aisha@skillquest.demo',createdAt:'2026-04-15T00:00:00Z'},
    {id:'demo_2',name:'Raj M.',email:'raj@skillquest.demo',createdAt:'2026-04-16T00:00:00Z'},
    {id:'demo_3',name:'Sofia L.',email:'sofia@skillquest.demo',createdAt:'2026-04-17T00:00:00Z'},
    {id:'demo_4',name:'Kevin T.',email:'kevin@skillquest.demo',createdAt:'2026-04-18T00:00:00Z'},
    {id:'demo_5',name:'Priya N.',email:'priya@skillquest.demo',createdAt:'2026-04-19T00:00:00Z'}
  ];
  var pts = [480,395,310,225,140];
  var courses = [
    [{s:'ai-tech',c:'what-is-ai'},{s:'finance',c:'budgeting-101'},{s:'cybersecurity',c:'online-safety'}],
    [{s:'finance',c:'budgeting-101'},{s:'career',c:'resume-writing'},{s:'digital',c:'productivity-tools'}],
    [{s:'entrepreneurship',c:'business-ideation'},{s:'ai-tech',c:'what-is-ai'},{s:'finance',c:'smart-investing'}],
    [{s:'cybersecurity',c:'password-security'},{s:'digital',c:'cloud-computing'}],
    [{s:'career',c:'interview-skills'},{s:'finance',c:'understanding-credit'}]
  ];
  var existing = JSON.parse(localStorage.getItem('sq_users')||'[]');
  var hasDemo = existing.some(function(u){return u.id&&u.id.indexOf('demo_')===0;});
  if(!hasDemo){
    demo.forEach(function(u,i){
      existing.push(u);
      localStorage.setItem('sq_points_'+u.id, pts[i]);
      var prog = {};
      courses[i].forEach(function(x){
        if(!prog[x.s]) prog[x.s]={};
        prog[x.s][x.c]={lessonsCompleted:['l1','l2','l3'],quizScore:Math.floor(Math.random()*2)+4,completed:true,completedAt:new Date().toISOString(),pointsEarned:Math.floor(pts[i]/courses[i].length)};
      });
      localStorage.setItem('sq_progress_'+u.id, JSON.stringify(prog));
    });
    localStorage.setItem('sq_users', JSON.stringify(existing));
  }
  localStorage.setItem('sq_seeded','1');
})();
