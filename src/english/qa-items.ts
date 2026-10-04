/**
 * Hỏi – đáp ngắn theo chủ đề từng Unit (lớp 3–5). Toàn bộ câu do nhóm tự viết.
 * Dòng: lớp.unit|câu hỏi|dịch câu hỏi|câu trả lời đúng|nhiễu 1|nhiễu 2|nhiễu 3
 * Quy tắc: phương án nhiễu không bao giờ là một câu trả lời hợp lý; không dùng cặp Yes/No làm nhiễu.
 */
import type { Grade } from '../math/types';

export interface QaItem {
  grade: Grade;
  unit: number;
  q: string;
  vi: string;
  answer: string;
  wrong: string[];
}

const G3 = `
3.1|Hello. How are you?|Xin chào. Bạn có khỏe không?|I'm fine, thank you.|My name is Mai.|It's a ruler.|Goodbye, Tom.
3.1|Goodbye, Lan!|Tạm biệt Lan!|Bye, Nam. See you later.|I'm fine, thank you.|It's a pen.|Nice to meet you, too.
3.1|Nice to meet you.|Rất vui được gặp bạn.|Nice to meet you, too.|I'm fine, thanks.|Goodbye, Mai.|It's a book.
3.2|What's your name?|Bạn tên là gì?|My name is Hoa.|I'm fine, thank you.|I'm eight years old.|It's a bag.
3.2|How old are you?|Bạn bao nhiêu tuổi?|I'm eight years old.|My name is Nam.|I'm fine, thanks.|It's blue.
3.2|Is your name Phong?|Tên bạn là Phong phải không?|Yes, it is.|I'm eight.|It's a ball.|Hello, Mai.
3.3|Who's that?|Đó là ai?|It's my friend Minh.|It's a pencil.|I'm fine, thanks.|I'm eight years old.
3.3|Is he your friend?|Bạn ấy có phải bạn của bạn không?|Yes, he is.|Yes, it is.|I'm eight.|It's red.
3.3|What's this?|Đây là cái gì?|It's a school bag.|He's my friend.|I'm Nam.|Yes, he is.
3.4|What's this?|Đây là gì?|It's my nose.|They're my hands.|I'm fine.|Yes, I do.
3.4|What are these?|Đây là những cái gì?|They're my eyes.|It's my nose.|I'm eight.|My name is Mai.
3.5|What's your hobby?|Sở thích của bạn là gì?|I like swimming.|I'm swimming.|It's a ball.|My name is Lan.
3.5|Do you like singing?|Bạn có thích hát không?|Yes, I do.|Yes, I am.|It's a song.|I'm eight.
3.6|Is this our classroom?|Đây có phải lớp học của chúng mình không?|Yes, it is.|Yes, I do.|They're books.|I'm Mai.
3.6|What's that?|Kia là cái gì?|It's the library.|He's my teacher.|I'm fine.|They're my friends.
3.6|Let's go to the gym.|Chúng mình đến phòng thể dục đi.|OK, let's go.|It's a gym.|I'm nine.|Yes, it is.
3.7|May I come in?|Em vào lớp được không ạ?|Yes, you can.|Yes, I am.|It's a pen.|I'm Nam.
3.7|Be quiet, please!|Các em trật tự nào!|Sorry, Miss Hoa.|Yes, it is.|I'm nine years old.|It's my bag.
3.7|May I go out?|Em ra ngoài được không ạ?|Yes, you can.|It's a door.|I'm fine.|My name is Vy.
3.8|Do you have a ruler?|Bạn có thước kẻ không?|Yes, I do.|Yes, it is.|It's blue.|I'm Minh.
3.8|What are these?|Đây là những cái gì?|They're my pencils.|It's my pencil.|I'm eight.|Yes, I do.
3.8|Is this your pen?|Đây có phải bút của bạn không?|Yes, it is.|Yes, I do.|They're pens.|I'm Lan.
3.9|What colour is your bag?|Cặp của bạn màu gì?|It's blue.|It's a bag.|Yes, I do.|I'm eight years old.
3.9|What colour are your shoes?|Giày của bạn màu gì?|They're black.|It's a shoe.|I'm fine.|My name is Huy.
3.9|Is your pen red?|Bút của bạn màu đỏ phải không?|Yes, it is.|Yes, I do.|It's a pen.|I'm Mai.
3.10|What do you do at break time?|Giờ ra chơi bạn làm gì?|I play football.|I'm eight years old.|It's a ball.|Yes, I do.
3.10|Do you like skipping?|Bạn có thích nhảy dây không?|Yes, I do.|Yes, it is.|It's a rope.|I'm Hoa.
3.10|Let's play chess.|Chúng mình chơi cờ vua nhé.|Great idea!|It's a chess board.|I'm nine.|Yes, it is.
3.11|Who's this?|Đây là ai?|It's my father.|It's a pencil.|I'm fine, thanks.|Yes, he is.
3.11|How old is your brother?|Anh trai bạn bao nhiêu tuổi?|He's twelve years old.|He's tall.|My name is Nam.|It's my bag.
3.11|Is she your mother?|Đó có phải mẹ bạn không?|Yes, she is.|Yes, he is.|It's a cake.|I'm eight.
3.12|What's your father's job?|Bố bạn làm nghề gì?|He's a farmer.|She's a farmer.|He's forty.|I'm eight.
3.12|Is she a nurse?|Cô ấy có phải là y tá không?|Yes, she is.|Yes, she does.|It's a hospital.|I'm nine.
3.13|Where's the kitchen?|Nhà bếp ở đâu?|It's over there.|It's a kitchen.|I'm eight.|Yes, I do.
3.13|Is there a garden?|Có khu vườn không?|Yes, there is.|Yes, it is.|It's big.|I'm Lan.
3.13|Where's your mother?|Mẹ bạn đang ở đâu?|She's in the living room.|She's a teacher.|It's my house.|I'm fine, thanks.
3.14|Where's the teddy bear?|Con gấu bông ở đâu?|It's on the bed.|They're on the bed.|It's a teddy bear.|Yes, it is.
3.14|Where are the books?|Những quyển sách ở đâu?|They're on the shelf.|It's on the shelf.|They're books.|I'm Phong.
3.14|Is your bedroom big?|Phòng ngủ của bạn có rộng không?|Yes, it is.|Yes, I do.|It's a bed.|I'm nine.
3.15|What would you like to eat?|Bạn muốn ăn gì?|I'd like some rice, please.|I'm eight.|It's a table.|Yes, it is.
3.15|Would you like some milk?|Bạn có muốn uống sữa không?|Yes, please.|Yes, I am.|It's a cup.|I'm Vy.
3.15|What would you like to drink?|Bạn muốn uống gì?|I'd like some water, please.|I'd like some bread, please.|It's a glass.|I'm fine.
3.16|Do you have any pets?|Bạn có nuôi thú cưng không?|Yes, I have a cat.|Yes, I am.|It's a pet shop.|I'm nine.
3.16|How many dogs do you have?|Bạn có mấy con chó?|I have two dogs.|I have a ball.|They're brown.|Yes, I do.
3.16|Where's the cat?|Con mèo ở đâu?|It's under the table.|It's a cat.|They're cute.|I'm Lan.
3.17|What toys do you like?|Bạn thích đồ chơi nào?|I like robots.|I'm eight.|It's red.|Yes, they are.
3.17|How many teddy bears do you have?|Bạn có mấy con gấu bông?|I have three.|I like teddy bears.|It's big.|Yes, I do.
3.17|Is this your kite?|Đây có phải cái diều của bạn không?|Yes, it is.|Yes, they are.|I'm nine.|I like dolls.
3.18|What are you doing?|Bạn đang làm gì thế?|I'm reading a book.|I read a book.|It's a book.|Yes, I am.
3.18|What's she doing?|Bạn ấy đang làm gì?|She's drawing a picture.|She draws a picture.|It's a picture.|Yes, she is.
3.18|Are you listening to music?|Bạn đang nghe nhạc à?|Yes, I am.|Yes, I do.|It's music.|I'm nine.
3.19|What are they doing?|Họ đang làm gì?|They're flying kites.|They fly kites.|It's a kite.|Yes, they are.
3.19|Is he cycling in the park?|Bạn ấy đang đạp xe trong công viên à?|Yes, he is.|Yes, he does.|It's a bike.|I'm Huy.
3.19|Where are you?|Bạn đang ở đâu?|I'm in the park.|I'm eight.|It's a park.|Yes, I am.
3.20|What can you see?|Bạn nhìn thấy gì?|I can see a monkey.|Yes, I can.|I'm nine years old.|My name is Mai.
3.20|What's the elephant doing?|Con voi đang làm gì?|It's drinking water.|It's an elephant.|They're big.|Yes, it is.
3.20|Are the monkeys climbing?|Những con khỉ đang leo trèo à?|Yes, they are.|Yes, it is.|I'm Vy.|It's a tree.
`;

const G4 = `
4.1|Where are you from?|Bạn đến từ đâu?|I'm from Viet Nam.|I'm ten years old.|It's a map.|Yes, I am.
4.1|Where's Tom from?|Tom đến từ đâu?|He's from England.|He's ten years old.|It's in England.|Yes, he is.
4.1|Who's your best friend?|Bạn thân nhất của bạn là ai?|My best friend is Mai.|It's a pencil case.|I'm from Japan.|Yes, she is.
4.2|What time is it?|Bây giờ là mấy giờ?|It's seven o'clock.|It's Monday.|I'm seven.|Yes, it is.
4.2|What time do you get up?|Bạn thức dậy lúc mấy giờ?|I get up at six o'clock.|I get up on Monday.|I'm six years old.|Yes, I do.
4.2|When do you have breakfast?|Bạn ăn sáng khi nào?|At half past six.|It's a sandwich.|I'm hungry.|Yes, I do.
4.3|What day is it today?|Hôm nay là thứ mấy?|It's Tuesday.|It's sunny.|It's seven o'clock.|Yes, it is.
4.3|What do you do on Saturdays?|Bạn làm gì vào các ngày thứ Bảy?|I play badminton.|On Saturday.|I'm ten.|It's Saturday.
4.3|When do you have English?|Khi nào bạn có môn Tiếng Anh?|On Mondays and Fridays.|It's English.|In the library.|Yes, I do.
4.4|When is your birthday?|Sinh nhật của bạn vào khi nào?|It's in May.|I'm ten years old.|It's a cake.|Yes, it is.
4.4|What did you do at the party?|Bạn đã làm gì ở bữa tiệc?|We sang and danced.|We sing and dance.|It's a party.|It's in June.
4.4|How old are you now?|Bây giờ bạn bao nhiêu tuổi?|I'm ten years old.|It's in May.|It's a present.|Yes, I am.
4.5|What can you do?|Bạn có thể làm gì?|I can swim.|I'm swimming.|It's a pool.|I'm ten.
4.5|Can you play the guitar?|Bạn có biết chơi ghi-ta không?|Yes, I can.|Yes, I do.|It's a guitar.|I'm ten.
4.5|Can she ride a bike?|Bạn ấy có biết đi xe đạp không?|No, she can't.|No, she isn't.|It's a bike.|I'm ten.
4.6|Where's the computer room?|Phòng máy tính ở đâu?|It's on the second floor.|It's a computer.|I'm in class 4A.|Yes, it is.
4.6|Is there a library in your school?|Trường bạn có thư viện không?|Yes, there is.|Yes, it is.|It's big.|I'm ten.
4.6|What's your school like?|Trường của bạn như thế nào?|It's big and beautiful.|It's in Ha Noi.|I'm in class 4B.|Yes, I do.
4.7|What subjects do you have today?|Hôm nay bạn có những môn gì?|I have Maths and English.|It's Monday.|I'm in class 4A.|Yes, I do.
4.7|When do you have Music?|Khi nào bạn có môn Âm nhạc?|I have it on Thursdays.|I like Music.|It's a guitar.|Yes, I do.
4.7|How many lessons do you have today?|Hôm nay bạn có mấy tiết học?|I have five lessons.|I have Maths.|It's Monday.|Yes, I do.
4.8|What's your favourite subject?|Môn học yêu thích của bạn là gì?|It's Science.|It's Monday.|I'm ten.|Yes, it is.
4.8|Why do you like Art?|Tại sao bạn thích môn Mĩ thuật?|Because I like drawing.|Because it's Monday.|It's on Friday.|Yes, I do.
4.8|Who's your English teacher?|Ai là thầy/cô dạy Tiếng Anh của bạn?|It's Miss Hien.|It's on Tuesday.|I like English.|Yes, she is.
4.9|When is your sports day?|Ngày hội thể thao của trường bạn là khi nào?|It's in October.|It's in the playground.|I like sports.|Yes, it is.
4.9|What sport do you play?|Bạn chơi môn thể thao nào?|I play basketball.|I'm playing now.|It's on Sunday.|Yes, I do.
4.9|Did you win the race?|Bạn có thắng cuộc đua không?|Yes, I did.|Yes, I do.|It's a race.|I'm ten.
4.10|Where did you go last summer?|Hè năm ngoái bạn đã đi đâu?|I went to Nha Trang.|I go to Nha Trang.|It's hot.|Yes, I did.
4.10|What did you do there?|Bạn đã làm gì ở đó?|I swam in the sea.|I swim in the sea.|It was July.|Yes, I did.
4.10|Was the beach beautiful?|Bãi biển có đẹp không?|Yes, it was.|Yes, I was.|It's a beach.|I'm ten.
4.11|Where do you live?|Bạn sống ở đâu?|I live in a big city.|I like big cities.|It's a house.|Yes, I do.
4.11|Do you live in a flat?|Bạn sống trong căn hộ phải không?|Yes, I do.|Yes, I am.|I'm in class 4A.|I'm ten.
4.11|What's the street like?|Con phố như thế nào?|It's busy and noisy.|It's a street.|I live here.|Yes, it is.
4.12|What does your mother do?|Mẹ bạn làm nghề gì?|She's a nurse.|She's forty.|He's a nurse.|Yes, she does.
4.12|Where does a farmer work?|Bác nông dân làm việc ở đâu?|On a farm.|He's a farmer.|At seven o'clock.|Yes, he does.
4.12|Where does a doctor work?|Bác sĩ làm việc ở đâu?|In a hospital.|On a farm.|In the morning.|Yes, he does.
4.13|What does she look like?|Bạn ấy trông như thế nào?|She's tall and thin.|She likes reading.|She's a pupil.|Yes, she does.
4.13|What does your father look like?|Bố bạn trông như thế nào?|He's tall and strong.|He's a doctor.|He likes football.|Yes, he is.
4.13|Is her hair long?|Tóc bạn ấy có dài không?|Yes, it is.|Yes, she is.|It's black.|I'm ten.
4.14|What do you do in the morning?|Buổi sáng bạn làm gì?|I go to school.|It's seven o'clock.|I'm ten years old.|Yes, I do.
4.14|What does your mother do after dinner?|Mẹ bạn làm gì sau bữa tối?|She washes the dishes.|She wash the dishes.|It's a dish.|Yes, she does.
4.14|Do you help your parents?|Bạn có giúp bố mẹ không?|Yes, I do.|Yes, I am.|They're kind.|I'm ten.
4.15|What do you do at the weekend?|Cuối tuần bạn làm gì?|I visit my grandparents.|At the weekend.|It's Saturday.|Yes, I do.
4.15|What did your family do last Sunday?|Chủ nhật tuần trước gia đình bạn đã làm gì?|We went to the cinema.|We go to the cinema.|It was Sunday.|Yes, we did.
4.15|Where do you go on Sundays?|Chủ nhật bạn thường đi đâu?|We go to the park.|I'm ten years old.|It's Sunday.|Yes, we do.
4.16|What's the weather like today?|Hôm nay thời tiết thế nào?|It's sunny and hot.|It's Monday.|It's an umbrella.|Yes, it is.
4.16|Is it raining?|Trời đang mưa à?|Yes, it is.|Yes, I do.|It's an umbrella.|I'm ten.
4.16|What's the weather like in winter?|Mùa đông thời tiết thế nào?|It's cold.|It's a coat.|I like winter.|Yes, it is.
4.17|Where's the post office?|Bưu điện ở đâu?|It's next to the bank.|It's a post office.|I'm ten.|Yes, it is.
4.17|How can I get to the zoo?|Mình đến vườn thú bằng cách nào?|Go straight and turn left.|It's a big zoo.|I like animals.|Yes, you can.
4.17|Is the museum far from here?|Bảo tàng có xa đây không?|No, it isn't.|No, I don't.|It's a museum.|I'm ten.
4.18|How much is this T-shirt?|Cái áo phông này giá bao nhiêu?|It's fifty thousand dong.|It's a T-shirt.|It's blue.|Yes, it is.
4.18|What would you like to buy?|Bạn muốn mua gì?|I'd like a pair of shoes.|It's expensive.|I'm ten.|Yes, please.
4.18|How much are these jeans?|Cái quần bò này giá bao nhiêu?|They're two hundred thousand dong.|They're blue.|They're jeans.|Yes, they are.
4.19|What animal do you like?|Bạn thích con vật nào?|I like tigers.|I'm a tiger.|It's at the zoo.|Yes, I do.
4.19|Why do you like elephants?|Tại sao bạn thích voi?|Because they're big and strong.|Because I'm ten.|It's an elephant.|Yes, I do.
4.19|What can a kangaroo do?|Con chuột túi có thể làm gì?|It can jump very high.|It's a kangaroo.|It's from Australia.|Yes, it can.
4.20|Where are you now?|Bây giờ bạn đang ở đâu?|I'm at the summer camp.|I'm ten.|It's a tent.|Yes, I am.
4.20|What are you doing at the camp?|Bạn đang làm gì ở trại hè?|We're putting up a tent.|We put up a tent.|It's a big camp.|Yes, we are.
4.20|Are you having fun?|Bạn có vui không?|Yes, we are.|Yes, we do.|It's a campfire.|I'm ten.
`;

const G5 = `
5.1|What class are you in?|Bạn học lớp nào?|I'm in class 5A.|I'm eleven years old.|It's a big class.|Yes, I am.
5.1|What are you like?|Bạn là người như thế nào?|I'm friendly and kind.|I like reading.|I'm in class 5B.|Yes, I am.
5.1|What's your favourite food?|Món ăn yêu thích của bạn là gì?|It's fried chicken.|It's in the kitchen.|I'm hungry.|Yes, it is.
5.2|What's your address?|Địa chỉ của bạn là gì?|It's 15 Le Loi Street.|I'm eleven years old.|It's a big city.|Yes, it is.
5.2|Do you live in this house?|Bạn sống trong ngôi nhà này à?|Yes, I do.|Yes, it is.|I'm in class 5A.|I'm eleven.
5.2|What's your village like?|Làng của bạn như thế nào?|It's quiet and beautiful.|I'm eleven years old.|I live in a flat.|Yes, it is.
5.3|What nationality are you?|Bạn mang quốc tịch gì?|I'm Vietnamese.|I'm eleven.|It's a big country.|Yes, I am.
5.3|Where's your friend Akiko from?|Bạn Akiko của bạn đến từ đâu?|She's from Japan.|She's eleven.|It's a map.|Yes, she is.
5.3|What's he like?|Bạn ấy là người như thế nào?|He's clever and funny.|He's from Australia.|He likes football.|Yes, he is.
5.4|What do you do in your free time?|Lúc rảnh rỗi bạn làm gì?|I often read books.|I'm reading a book now.|It's Sunday.|Yes, I do.
5.4|How often do you go swimming?|Bạn có hay đi bơi không?|Twice a week.|At the pool.|I like swimming.|Yes, I do.
5.4|What does your brother do at the weekend?|Anh trai bạn làm gì vào cuối tuần?|He plays computer games.|He play computer games.|It's Saturday.|Yes, he does.
5.5|What would you like to be?|Bạn muốn làm nghề gì?|I'd like to be a doctor.|I'd like some rice.|I'm a pupil.|Yes, I would.
5.5|Why would you like to be a teacher?|Tại sao bạn muốn làm giáo viên?|Because I love children.|Because it's Monday.|I'm at school.|Yes, I would.
5.5|Where does a pilot work?|Phi công làm việc ở đâu?|On a plane.|In a hospital.|At seven o'clock.|Yes, he does.
5.6|Where's the music room?|Phòng âm nhạc ở đâu?|It's on the third floor.|It's a music room.|I like music.|Yes, it is.
5.6|Which floor is the library on?|Thư viện ở tầng mấy?|It's on the ground floor.|It's a big library.|I'm in class 5A.|Yes, it is.
5.6|How many classrooms are there?|Có bao nhiêu phòng học?|There are twenty classrooms.|They're on the first floor.|It's big.|Yes, there are.
5.7|What school activity do you like?|Bạn thích hoạt động nào ở trường?|I like playing chess.|I'm playing chess.|It's at school.|Yes, I do.
5.7|Why do you like singing?|Tại sao bạn thích hát?|Because it's fun.|Because it's a song.|I sing every day.|Yes, I do.
5.7|What do you do at break time?|Giờ ra chơi bạn làm gì?|I play with my friends.|It's ten o'clock.|I'm in class 5C.|Yes, I do.
5.8|Where's your teacher's desk?|Bàn giáo viên ở đâu?|It's in front of the board.|It's a big desk.|She's my teacher.|Yes, it is.
5.8|What's on the wall?|Trên tường có gì?|There's a map of Viet Nam.|It's a wall.|It's next to the door.|Yes, there is.
5.8|Whose book is this?|Quyển sách này của ai?|It's Mai's book.|It's a good book.|It's on the desk.|Yes, it is.
5.9|What did you do yesterday afternoon?|Chiều hôm qua bạn đã làm gì?|I played football with friends.|I play football with friends.|It was sunny.|Yes, I did.
5.9|Where did you go fishing?|Bạn đã đi câu cá ở đâu?|At the lake near my house.|Last Sunday.|I like fishing.|Yes, I did.
5.9|Did you enjoy the picnic?|Bạn có thích chuyến dã ngoại không?|Yes, I did.|Yes, I do.|It was in the park.|I'm eleven.
5.10|Where did you go on your school trip?|Chuyến đi của trường bạn đã đến đâu?|We went to Ha Long Bay.|We go to Ha Long Bay.|We went by coach.|Yes, we did.
5.10|How did you get there?|Bạn đã đến đó bằng cách nào?|We went by coach.|We went to the zoo.|It was great.|Yes, we did.
5.10|What did you see there?|Bạn đã thấy gì ở đó?|We saw many old buildings.|We see many old buildings.|We went by train.|Yes, we did.
5.11|What do you do with your family?|Bạn làm gì cùng gia đình?|We cook dinner together.|They're my parents.|It's Sunday.|Yes, we do.
5.11|What did you do last weekend?|Cuối tuần trước bạn đã làm gì?|I visited my grandparents.|I visit my grandparents.|It was Saturday.|Yes, I did.
5.11|Who did you go with?|Bạn đã đi cùng ai?|I went with my cousins.|I went by bus.|I went to the park.|Yes, I did.
5.12|What do you do at Tet?|Bạn làm gì vào dịp Tết?|I visit my relatives.|It's in January.|I like Tet.|Yes, I do.
5.12|What do people eat at Tet?|Mọi người ăn gì vào dịp Tết?|They eat banh chung.|They're happy.|It's in spring.|Yes, they do.
5.12|What do you say at Tet?|Vào dịp Tết bạn nói gì?|Happy New Year!|Happy birthday!|Thank you, teacher.|Yes, I do.
5.13|When is Teachers' Day in Viet Nam?|Ngày Nhà giáo Việt Nam là ngày nào?|It's on the twentieth of November.|It's in the classroom.|It's my teacher.|Yes, it is.
5.13|What do you do on Children's Day?|Bạn làm gì vào ngày Quốc tế Thiếu nhi?|We play games and get presents.|It's on the first of June.|I'm a child.|Yes, we do.
5.13|What will you give your teacher?|Bạn sẽ tặng thầy/cô món quà gì?|I'll give her some flowers.|I gave her some flowers.|She's my teacher.|Yes, I will.
5.14|What should I do to stay healthy?|Mình nên làm gì để khỏe mạnh?|You should do more exercise.|You should eat more sweets.|I'm healthy.|Yes, you should.
5.14|How often do you brush your teeth?|Bạn đánh răng bao lâu một lần?|Twice a day.|In the bathroom.|With a toothbrush.|Yes, I do.
5.14|Do you eat a lot of fruit?|Bạn có ăn nhiều hoa quả không?|Yes, I do.|Yes, I am.|It's an apple.|I'm eleven.
5.15|What's the matter with you?|Bạn bị làm sao vậy?|I have a headache.|I'm in class 5A.|It's a hospital.|Yes, I am.
5.15|What should she do?|Bạn ấy nên làm gì?|She should see a doctor.|She's a doctor.|She has a fever.|Yes, she should.
5.15|How do you feel today?|Hôm nay bạn thấy thế nào?|I feel much better, thanks.|It's Monday.|I'm eleven.|Yes, I do.
5.16|What's the weather like in summer?|Mùa hè thời tiết thế nào?|It's hot and sunny.|I like summer.|It's in June.|Yes, it is.
5.16|Which season do you like best?|Bạn thích mùa nào nhất?|I like autumn best.|It's cool.|I'm eleven.|Yes, I do.
5.16|What will the weather be like tomorrow?|Ngày mai thời tiết sẽ thế nào?|It will be rainy.|It was rainy.|It's Monday.|Yes, it will.
5.17|What's your favourite story?|Câu chuyện yêu thích của bạn là gì?|It's a story about a brave boy.|It's on the shelf.|I read it yesterday.|Yes, it is.
5.17|What is the fox like?|Con cáo là con vật thế nào?|It's very clever.|It's in the forest.|It's a story.|Yes, it is.
5.17|What happened in the end?|Cuối cùng chuyện gì đã xảy ra?|The boy found his mother.|The boy is ten.|It's a long story.|Yes, it did.
5.18|How do you get to school?|Bạn đến trường bằng cách nào?|I go by bus.|I go to school.|It's a school bus.|Yes, I do.
5.18|How long does it take?|Mất bao lâu?|About fifteen minutes.|By bike.|It's far.|Yes, it does.
5.18|How far is your school from home?|Trường bạn cách nhà bao xa?|It's about two kilometres.|By motorbike.|It's a big school.|Yes, it is.
5.19|Where would you like to go?|Bạn muốn đi đâu?|I'd like to visit Hoi An.|I'd like some noodles.|I went there last year.|Yes, I would.
5.19|What do you think of Ha Long Bay?|Bạn nghĩ gì về vịnh Hạ Long?|It's very beautiful.|It's in Quang Ninh.|I went by boat.|Yes, I do.
5.19|What can you see at the museum?|Ở bảo tàng bạn có thể xem gì?|You can see old things.|You can go by bus.|It opens at eight.|Yes, you can.
5.20|Where will you go this summer?|Hè này bạn sẽ đi đâu?|I'll go to Da Nang.|I went to Da Nang.|I'll go by plane.|Yes, I will.
5.20|What will you do there?|Bạn sẽ làm gì ở đó?|I'll swim in the sea.|I swam in the sea.|I'll go by train.|Yes, I will.
5.20|Who will you go with?|Bạn sẽ đi cùng ai?|I'll go with my family.|I'll go next week.|I'll go by car.|Yes, I will.
`;

function parse(line: string): QaItem {
  const [gu, q, vi, answer, ...wrong] = line.split('|').map((s) => s.trim());
  const [g, u] = gu.split('.').map(Number);
  if (!(g >= 3 && g <= 5) || !(u >= 1) || !q || !vi || !answer || wrong.length !== 3 || wrong.some((w) => !w)) {
    throw new Error(`QA_ITEMS: dòng sai định dạng: ${line}`);
  }
  return { grade: g as Grade, unit: u, q, vi, answer, wrong };
}

export const QA_ITEMS: QaItem[] = [G3, G4, G5]
  .flatMap((block) => block.split('\n'))
  .map((l) => l.trim())
  .filter(Boolean)
  .map(parse);
