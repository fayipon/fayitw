<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

use App\Models\Stock;
use App\Models\Test;
/************************************
*  
*  TradingView Bot
*  
*************************************/

class TgBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);
        $reponse = $this->request;
        $this->record($reponse);

        date_default_timezone_set("Asia/Taipei");
        
        $reponse['ticker']  = str_replace([".P"], [""], $reponse['ticker']);

        $mode = "";
        switch ($reponse['mode']) {
            case "PD":
                $mode = "頂背離";
                break;
            case "ND":
                $mode = "底背離";
                break;
            case "PDH":
                $mode = "隱性頂背離";
                break;
            case "NDH":
                $mode = "隱性底背離";
                break;
            }

        $this->send($reponse, $mode);
    }

    // send message
    protected function send($reponse, $mode) {

        $message = $reponse['ticker'] . " " . $reponse['type'] . " " . $mode . "
=========================
當前價格 : " . $reponse['close'] . "
發送時間 : " . date("Y-m-d H:i:s") . "

Binance : https://www.binance.com/zh-TC/futures/" . $reponse['ticker'] . "
";
        
        // 我自已 測試用
        file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=545205414&text=" . urlencode($message));
        
        // 群
        // file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=-4264595778&text=" . urlencode($message));

    }

    // request 紀錄
    protected function record($reponse) {
        Test::create([
            "data" => json_encode($reponse)
        ]);
    } 
    
}
